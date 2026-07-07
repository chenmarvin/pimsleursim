import { useEffect, useRef, useState } from "react";
import type { LessonStep, MasteryMap } from "@pimsleursim/shared";
import { applyStepResult, computeInLessonRetestOffset, initMasteryState } from "@pimsleursim/shared";
import { speakText as speak } from "../audio/audioPlayer.js";
import { ConversationView } from "../components/ConversationView.js";
import { Furigana } from "../components/Furigana.js";
import type { ResponseEvaluator } from "../evaluation/ResponseEvaluator.js";
import { FuzzyTextEvaluator } from "../evaluation/fuzzyTextEvaluator.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";
import { loadDeck, saveMasteryMap } from "../storage/masteryStore.js";

const evaluator: ResponseEvaluator = new FuzzyTextEvaluator();

type Phase = "playing" | "awaiting-input" | "revealing" | "complete";

interface Props {
  initialSteps: LessonStep[];
  initialMasteryMap: MasteryMap;
  sourceLanguage: string;
  targetLanguage: string;
  onFinish: () => void;
  finishLabel?: string;
}

interface SessionStats {
  introduced: number;
  reviewed: number;
  correct: number;
}

// Alternate readings (e.g. 七 also read なな) are shown alongside the
// furigana-annotated phrase — the primary reading is already visible inline
// as furigana, so only the extras need calling out separately.
function alternateReadingsDisplay(step: LessonStep): string | null {
  if (!step.alternateReadings || step.alternateReadings.length === 0) return null;
  return step.alternateReadings.join("／");
}

export function LessonPlayerScreen({
  initialSteps,
  initialMasteryMap,
  sourceLanguage,
  targetLanguage,
  onFinish,
  finishLabel,
}: Props) {
  const { t } = useUiLanguage();
  const [queue, setQueue] = useState<LessonStep[]>(initialSteps);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [typedInput, setTypedInput] = useState("");
  const [practiceInput, setPracticeInput] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean; score: number } | null>(null);
  const [isRepeating, setIsRepeating] = useState(false);
  const masteryRef = useRef<MasteryMap>(initialMasteryMap);
  const statsRef = useRef<SessionStats>({ introduced: 0, reviewed: 0, correct: 0 });

  const currentStep = queue[index];

  useEffect(() => {
    if (!currentStep) {
      setPhase("complete");
      return;
    }

    // No extra "already running" guard here: each effect invocation gets
    // its own `cancelled` closure, which is all that's needed for correct
    // cleanup — including under React 18 StrictMode's dev-only double
    // mount/cleanup/mount cycle. An additional shared "is running" ref
    // would block the correctly re-invoked second mount from ever running,
    // leaving only the first (already-cancelled) run in flight, which
    // bails out at its first `if (cancelled) return` and never advances.
    let cancelled = false;
    (async () => {
      setPhase("playing");
      setFeedback(null);
      setTypedInput("");
      setPracticeInput("");
      try {
        if (currentStep.type === "introduce") {
          await speak(currentStep.targetPhrase, targetLanguage);
          if (cancelled) return;
          await speak(currentStep.sourcePhrase, sourceLanguage);
          if (cancelled) return;
          statsRef.current.introduced += 1;
          setIndex((i) => i + 1);
        } else {
          await speak(currentStep.sourcePhrase, sourceLanguage);
          if (cancelled) return;
          setPhase("awaiting-input");
        }
      } catch (err) {
        console.error("Playback failed", err);
        if (!cancelled) setPhase(currentStep.type === "anticipate" ? "awaiting-input" : "playing");
      }
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately depends on `index` only. `currentStep` is recomputed
    // from the latest `queue` on every render, so a step change (learner
    // advances) always picks up any spliced-in retests — but a `queue`
    // mutation ALONE (splicing a retest into the future while grading the
    // current step) must not re-trigger this effect for the step that's
    // already being displayed, or it clobbers the reveal/feedback UI that
    // was just set for that same step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  async function handleSubmitAnswer() {
    if (!currentStep) return;
    const result = await evaluator.evaluate(
      typedInput,
      currentStep.targetPhrase,
      targetLanguage,
      currentStep.kanaReading,
      currentStep.alternateReadings,
    );
    setFeedback({ correct: result.correct, score: result.score });
    setPhase("revealing");
    statsRef.current.reviewed += 1;
    if (result.correct) statsRef.current.correct += 1;

    const now = new Date();
    const previous = masteryRef.current[currentStep.itemId] ?? initMasteryState(currentStep.itemId);
    const updated = applyStepResult(previous, result.correct, now);
    masteryRef.current = { ...masteryRef.current, [currentStep.itemId]: updated };
    saveMasteryMap(masteryRef.current);

    const retestOffset = computeInLessonRetestOffset(updated);
    if (retestOffset !== null) {
      const insertAt = Math.min(queue.length, index + 1 + retestOffset);
      const retestStep: LessonStep = {
        stepIndex: insertAt,
        type: "anticipate",
        itemId: currentStep.itemId,
        targetPhrase: currentStep.targetPhrase,
        sourcePhrase: currentStep.sourcePhrase,
        kanaReading: currentStep.kanaReading,
        alternateReadings: currentStep.alternateReadings,
        furigana: currentStep.furigana,
      };
      setQueue((q) => {
        const next = [...q];
        next.splice(insertAt, 0, retestStep);
        return next;
      });
    }

    try {
      await speak(currentStep.targetPhrase, targetLanguage);
    } catch (err) {
      console.error("Reveal playback failed", err);
    }
  }

  function handleContinue() {
    setIndex((i) => i + 1);
  }

  async function handleRepeat(...phrases: { text: string; languageCode: string }[]) {
    if (isRepeating) return;
    setIsRepeating(true);
    try {
      for (const { text, languageCode } of phrases) {
        await speak(text, languageCode);
      }
    } catch (err) {
      console.error("Repeat playback failed", err);
    } finally {
      setIsRepeating(false);
    }
  }

  if (phase === "complete" || !currentStep) {
    const stats = statsRef.current;
    return (
      <div>
        <h2>{t("lessonComplete")}</h2>
        <p>{t("newItemsIntroduced", { count: stats.introduced })}</p>
        <p>{t("reviewsCompleted", { count: stats.reviewed })}</p>
        <p>{t("accuracy", { percent: stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0 })}</p>
        <ConversationView
          getVocab={() => loadDeck().catalog}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
        />
        <button onClick={onFinish}>{finishLabel ?? t("backToUpload")}</button>
      </div>
    );
  }

  return (
    <div>
      <p>{t("stepProgress", { current: index + 1, total: queue.length })}</p>
      {currentStep.type === "introduce" && (
        <div>
          <p>
            {t("introducingLabel")} <Furigana text={currentStep.targetPhrase} segments={currentStep.furigana} />
            {alternateReadingsDisplay(currentStep) && (
              <span>
                {" "}
                ({t("alsoAccepted")} {alternateReadingsDisplay(currentStep)})
              </span>
            )}{" "}
            <button
              onClick={() =>
                handleRepeat(
                  { text: currentStep.targetPhrase, languageCode: targetLanguage },
                  { text: currentStep.sourcePhrase, languageCode: sourceLanguage },
                )
              }
              disabled={isRepeating}
            >
              {t("repeat")}
            </button>
          </p>
          {currentStep.englishTranslation && (
            <p>
              <strong>{t("vocabEnglishLabel")}</strong> {currentStep.englishTranslation}
            </p>
          )}
          {currentStep.exampleSentence && (
            <p>
              <strong>{t("vocabExampleLabel")}</strong>{" "}
              <Furigana text={currentStep.exampleSentence} segments={currentStep.exampleFurigana} />
              {currentStep.exampleTranslation && <> ({currentStep.exampleTranslation})</>}{" "}
              <button
                onClick={() => handleRepeat({ text: currentStep.exampleSentence!, languageCode: targetLanguage })}
                disabled={isRepeating}
              >
                {t("repeat")}
              </button>
            </p>
          )}
          {currentStep.commonMistake && (
            <p>
              <strong>{t("vocabCommonMistakeLabel")}</strong> {currentStep.commonMistake}
            </p>
          )}
          {currentStep.memoryTip && (
            <p>
              <strong>{t("vocabMemoryTipLabel")}</strong> {currentStep.memoryTip}
            </p>
          )}
          {currentStep.chineseDifference && (
            <p>
              <strong>{t("vocabChineseNoteLabel")}</strong> {currentStep.chineseDifference}
            </p>
          )}
        </div>
      )}
      {currentStep.type === "anticipate" && phase === "awaiting-input" && (
        <div>
          <p>
            {t("howDoYouSay", { phrase: currentStep.sourcePhrase })}{" "}
            <button
              onClick={() => handleRepeat({ text: currentStep.sourcePhrase, languageCode: sourceLanguage })}
              disabled={isRepeating}
            >
              {t("repeat")}
            </button>
          </p>
          <input
            type="text"
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmitAnswer();
            }}
            autoFocus
          />
          <button onClick={handleSubmitAnswer}>{t("submit")}</button>
        </div>
      )}
      {currentStep.type === "anticipate" && phase === "revealing" && feedback && (
        <div>
          <p>{feedback.correct ? t("correct") : t("notQuite")}</p>
          <p>
            {t("correctAnswer")}{" "}
            <strong>
              <Furigana text={currentStep.targetPhrase} segments={currentStep.furigana} />
            </strong>
            {alternateReadingsDisplay(currentStep) && (
              <span>
                {" "}
                ({t("alsoAccepted")} {alternateReadingsDisplay(currentStep)})
              </span>
            )}{" "}
            <button
              onClick={() => handleRepeat({ text: currentStep.targetPhrase, languageCode: targetLanguage })}
              disabled={isRepeating}
            >
              {t("repeat")}
            </button>
          </p>
          <div>
            <label>
              {t("practiceWritingLabel")}{" "}
              <input
                type="text"
                value={practiceInput}
                onChange={(e) => setPracticeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleContinue(); }}
                placeholder={currentStep.kanaReading ?? currentStep.targetPhrase}
                autoFocus
              />
            </label>
          </div>
          <button onClick={handleContinue}>{t("continueLabel")}</button>
        </div>
      )}
    </div>
  );
}
