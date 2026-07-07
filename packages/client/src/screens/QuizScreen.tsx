import { useState } from "react";
import type { QuizSet } from "@pimsleursim/shared";
import { speakText as speak } from "../audio/audioPlayer.js";
import { FuzzyTextEvaluator } from "../evaluation/fuzzyTextEvaluator.js";
import type { ResponseEvaluator } from "../evaluation/ResponseEvaluator.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";

const evaluator: ResponseEvaluator = new FuzzyTextEvaluator();

const PILLAR_LABEL_KEYS = {
  vocabulary: "moduleVocab",
  grammar: "moduleGrammar",
  reading: "moduleReading",
  kanji: "moduleKanji",
} as const;

export interface QuizDrillPayload {
  quiz: QuizSet;
  sourceLanguage: string;
  targetLanguage: string;
}

interface Props extends QuizDrillPayload {
  onFinish: () => void;
  finishLabel?: string;
}

export function QuizScreen({ quiz, targetLanguage, onFinish, finishLabel }: Props) {
  const { t } = useUiLanguage();
  const [index, setIndex] = useState(0);
  const [typedInput, setTypedInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const question = quiz.questions[index];

  async function handlePlayAudio() {
    if (!question?.audioText || isPlaying) return;
    setIsPlaying(true);
    try {
      await speak(question.audioText, targetLanguage);
    } catch (err) {
      console.error("Playback failed", err);
    } finally {
      setIsPlaying(false);
    }
  }

  async function handleSubmitMultipleChoice(option: string) {
    if (feedback) return;
    setSelectedOption(option);
    const correct = option === question.answer;
    setFeedback({ correct });
    if (correct) setCorrectCount((c) => c + 1);
  }

  async function handleSubmitTyped() {
    if (feedback || !question) return;
    const result = await evaluator.evaluate(typedInput, question.answer, targetLanguage);
    setFeedback({ correct: result.correct });
    if (result.correct) setCorrectCount((c) => c + 1);
  }

  function handleNext() {
    setTypedInput("");
    setSelectedOption(null);
    setFeedback(null);
    setIndex((i) => i + 1);
  }

  if (!question) {
    return (
      <div>
        <h2>{t("quizComplete", { correct: correctCount, total: quiz.questions.length })}</h2>
        <button onClick={onFinish}>{finishLabel ?? t("backToDashboard")}</button>
      </div>
    );
  }

  return (
    <div>
      <h2>{t("quizScreenTitle")}</h2>
      <p>{t("quizStepProgress", { current: index + 1, total: quiz.questions.length })}</p>
      <p style={{ color: "#555" }}>{t(PILLAR_LABEL_KEYS[question.pillar])}</p>

      {question.type === "listening" && (
        <p>
          <button onClick={handlePlayAudio} disabled={isPlaying}>
            {isPlaying ? t("listeningPlaying") : t("listeningPlayAll")}
          </button>
        </p>
      )}

      <p>{question.prompt}</p>

      {question.type === "multiple_choice" && question.options ? (
        <div>
          {question.options.map((option) => (
            <div key={option}>
              <button
                onClick={() => handleSubmitMultipleChoice(option)}
                disabled={!!feedback}
                style={
                  feedback && option === question.answer
                    ? { fontWeight: "bold" }
                    : feedback && option === selectedOption
                      ? { textDecoration: "line-through" }
                      : undefined
                }
              >
                {option}
              </button>
            </div>
          ))}
        </div>
      ) : (
        !feedback && (
          <div>
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmitTyped();
              }}
              autoFocus
            />
            <button onClick={handleSubmitTyped}>{t("submit")}</button>
          </div>
        )
      )}

      {feedback && (
        <div>
          <p>{feedback.correct ? t("correct") : t("notQuite")}</p>
          {!feedback.correct && (
            <p>
              {t("correctAnswer")} {question.answer}
            </p>
          )}
          <button onClick={handleNext}>{t("continueLabel")}</button>
        </div>
      )}
    </div>
  );
}
