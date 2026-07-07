import { useEffect, useRef, useState } from "react";
import type { GrammarPoint } from "@pimsleursim/shared";
import { speakText as speak } from "../audio/audioPlayer.js";
import { FuzzyTextEvaluator } from "../evaluation/fuzzyTextEvaluator.js";
import type { ResponseEvaluator } from "../evaluation/ResponseEvaluator.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";
import { addCoveredPattern } from "../storage/grammarProgressStore.js";

const evaluator: ResponseEvaluator = new FuzzyTextEvaluator();

type Phase = "playing" | "awaiting-input" | "revealing" | "complete";

export interface GrammarDrillPayload {
  point: GrammarPoint;
  sourceLanguage: string;
  targetLanguage: string;
}

interface Props extends GrammarDrillPayload {
  onFinish: () => void;
}

export function GrammarDrillScreen({ point, sourceLanguage, targetLanguage, onFinish }: Props) {
  const { t } = useUiLanguage();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [typedInput, setTypedInput] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);
  const [isRepeating, setIsRepeating] = useState(false);
  const coveredRef = useRef(false);

  const currentSentence = point.sentences[index];

  useEffect(() => {
    if (!currentSentence) {
      if (!coveredRef.current) {
        coveredRef.current = true;
        addCoveredPattern(point.patternName);
      }
      setPhase("complete");
      return;
    }

    let cancelled = false;
    (async () => {
      setPhase("playing");
      setFeedback(null);
      setTypedInput("");
      try {
        if (index === 0) {
          await speak(currentSentence.targetText, targetLanguage);
          if (cancelled) return;
          await speak(currentSentence.sourceText, sourceLanguage);
          if (cancelled) return;
          setIndex((i) => i + 1);
        } else {
          await speak(currentSentence.sourceText, sourceLanguage);
          if (cancelled) return;
          setPhase("awaiting-input");
        }
      } catch (err) {
        console.error("Playback failed", err);
        if (!cancelled) setPhase(index === 0 ? "playing" : "awaiting-input");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  async function handleSubmitAnswer() {
    if (!currentSentence) return;
    const result = await evaluator.evaluate(typedInput, currentSentence.targetText, targetLanguage);
    setFeedback({ correct: result.correct });
    setPhase("revealing");
    try {
      await speak(currentSentence.targetText, targetLanguage);
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

  if (phase === "complete" || !currentSentence) {
    return (
      <div>
        <h2>{t("grammarPatternCovered", { pattern: point.patternName })}</h2>
        <button onClick={onFinish}>{t("backToDashboard")}</button>
      </div>
    );
  }

  return (
    <div>
      <h2>{point.patternName}</h2>
      <p>{point.explanation}</p>
      <p>{t("grammarStepProgress", { current: index + 1, total: point.sentences.length })}</p>
      {index === 0 && (
        <p>
          <strong>{currentSentence.targetText}</strong> ({currentSentence.sourceText}){" "}
          <button
            onClick={() =>
              handleRepeat(
                { text: currentSentence.targetText, languageCode: targetLanguage },
                { text: currentSentence.sourceText, languageCode: sourceLanguage },
              )
            }
            disabled={isRepeating}
          >
            {t("repeat")}
          </button>
        </p>
      )}
      {index > 0 && phase === "awaiting-input" && (
        <div>
          <p>
            {t("howDoYouSay", { phrase: currentSentence.sourceText })}{" "}
            <button
              onClick={() => handleRepeat({ text: currentSentence.sourceText, languageCode: sourceLanguage })}
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
      {index > 0 && phase === "revealing" && feedback && (
        <div>
          <p>{feedback.correct ? t("correct") : t("notQuite")}</p>
          <p>
            {t("correctAnswer")} <strong>{currentSentence.targetText}</strong>{" "}
            <button
              onClick={() => handleRepeat({ text: currentSentence.targetText, languageCode: targetLanguage })}
              disabled={isRepeating}
            >
              {t("repeat")}
            </button>
          </p>
          <button onClick={handleContinue}>{t("continueLabel")}</button>
        </div>
      )}
    </div>
  );
}
