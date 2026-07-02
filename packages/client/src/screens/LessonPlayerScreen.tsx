import { useEffect, useRef, useState } from "react";
import type { LessonStep, MasteryMap } from "@pimsleursim/shared";
import { applyStepResult, computeInLessonRetestOffset, initMasteryState } from "@pimsleursim/shared";
import { synthesizeSpeech } from "../api/client.js";
import { playBase64Audio } from "../audio/audioPlayer.js";
import type { ResponseEvaluator } from "../evaluation/ResponseEvaluator.js";
import { FuzzyTextEvaluator } from "../evaluation/fuzzyTextEvaluator.js";
import { saveMasteryMap } from "../storage/masteryStore.js";

const evaluator: ResponseEvaluator = new FuzzyTextEvaluator();

type Phase = "playing" | "awaiting-input" | "revealing" | "complete";

interface Props {
  initialSteps: LessonStep[];
  initialMasteryMap: MasteryMap;
  sourceLanguage: string;
  targetLanguage: string;
  onFinish: () => void;
}

interface SessionStats {
  introduced: number;
  reviewed: number;
  correct: number;
}

const TEXT_ONLY_READ_DELAY_MS = 900;

async function speak(text: string, languageCode: string): Promise<void> {
  const { audioBase64, mimeType } = await synthesizeSpeech({ text, languageCode });
  if (!audioBase64 || !mimeType) {
    // No TTS provider configured — hold the step long enough to read it
    // instead of flashing straight through with no natural audio pacing.
    await new Promise((resolve) => setTimeout(resolve, TEXT_ONLY_READ_DELAY_MS));
    return;
  }
  await playBase64Audio(audioBase64, mimeType);
}

export function LessonPlayerScreen({ initialSteps, initialMasteryMap, sourceLanguage, targetLanguage, onFinish }: Props) {
  const [queue, setQueue] = useState<LessonStep[]>(initialSteps);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [typedInput, setTypedInput] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean; score: number } | null>(null);
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
    const result = await evaluator.evaluate(typedInput, currentStep.targetPhrase, targetLanguage, currentStep.kanaReading);
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

  if (phase === "complete" || !currentStep) {
    const stats = statsRef.current;
    return (
      <div>
        <h2>Lesson complete</h2>
        <p>New items introduced: {stats.introduced}</p>
        <p>Reviews completed: {stats.reviewed}</p>
        <p>
          Accuracy: {stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0}%
        </p>
        <button onClick={onFinish}>Back to upload</button>
      </div>
    );
  }

  return (
    <div>
      <p>
        Step {index + 1} / {queue.length}
      </p>
      {currentStep.type === "introduce" && (
        <p>
          Introducing: {currentStep.targetPhrase}
          {currentStep.kanaReading && currentStep.kanaReading !== currentStep.targetPhrase && (
            <span> ({currentStep.kanaReading})</span>
          )}
        </p>
      )}
      {currentStep.type === "anticipate" && phase === "awaiting-input" && (
        <div>
          <p>How do you say: "{currentStep.sourcePhrase}"?</p>
          <input
            type="text"
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmitAnswer();
            }}
            autoFocus
          />
          <button onClick={handleSubmitAnswer}>Submit</button>
        </div>
      )}
      {currentStep.type === "anticipate" && phase === "revealing" && feedback && (
        <div>
          <p>{feedback.correct ? "Correct!" : "Not quite."}</p>
          <p>
            Correct answer: <strong>{currentStep.targetPhrase}</strong>
            {currentStep.kanaReading && currentStep.kanaReading !== currentStep.targetPhrase && (
              <span> ({currentStep.kanaReading})</span>
            )}
          </p>
          <button onClick={handleContinue}>Continue</button>
        </div>
      )}
    </div>
  );
}
