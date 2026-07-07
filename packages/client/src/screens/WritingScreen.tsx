import { useMemo, useState } from "react";
import type { WritingSentence } from "@pimsleursim/shared";
import { Furigana } from "../components/Furigana.js";
import { StrokeTraceCanvas } from "../components/StrokeTraceCanvas.js";
import { FuzzyTextEvaluator } from "../evaluation/fuzzyTextEvaluator.js";
import type { ResponseEvaluator } from "../evaluation/ResponseEvaluator.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";
import { loadKanjiProgress } from "../storage/kanjiProgressStore.js";

const evaluator: ResponseEvaluator = new FuzzyTextEvaluator();
const MAX_TRACE_KANJI = 5;

export interface WritingDrillPayload {
  sentences: WritingSentence[];
  sourceLanguage: string;
  targetLanguage: string;
}

interface Props extends WritingDrillPayload {
  onFinish: () => void;
  finishLabel?: string;
}

export function WritingScreen({ sentences, targetLanguage, onFinish, finishLabel }: Props) {
  const { t } = useUiLanguage();
  const [traceIndex, setTraceIndex] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [typedInput, setTypedInput] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);

  const traceKanji = useMemo(() => loadKanjiProgress().coveredKanji.slice(-MAX_TRACE_KANJI), []);
  const currentTraceChar = traceKanji[traceIndex];
  const currentSentence = sentences[sentenceIndex];

  async function handleSubmit() {
    if (!currentSentence) return;
    const result = await evaluator.evaluate(typedInput, currentSentence.targetText, targetLanguage);
    setFeedback({ correct: result.correct });
  }

  function handleNextSentence() {
    setTypedInput("");
    setFeedback(null);
    setSentenceIndex((i) => i + 1);
  }

  return (
    <div>
      <h2>{t("writingScreenTitle")}</h2>

      {traceKanji.length > 0 && (
        <section>
          <h3>{t("writingTraceLabel")}</h3>
          {currentTraceChar ? (
            <div>
              <p style={{ fontSize: "1.5em" }}>{currentTraceChar}</p>
              <StrokeTraceCanvas character={currentTraceChar} />
              <button onClick={() => setTraceIndex((i) => i + 1)}>{t("continueLabel")}</button>
            </div>
          ) : (
            <p>{t("writingTraceDone")}</p>
          )}
        </section>
      )}

      <section>
        <h3>{t("writingSentencesLabel")}</h3>
        {currentSentence ? (
          <div>
            <p>{t("writingStepProgress", { current: sentenceIndex + 1, total: sentences.length })}</p>
            <p>{currentSentence.sourceText}</p>
            {!feedback ? (
              <div>
                <input
                  type="text"
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  autoFocus
                />
                <button onClick={handleSubmit}>{t("submit")}</button>
              </div>
            ) : (
              <div>
                <p>{feedback.correct ? t("correct") : t("notQuite")}</p>
                <p>
                  {t("correctAnswer")}{" "}
                  <strong>
                    <Furigana text={currentSentence.targetText} segments={currentSentence.furigana} />
                  </strong>
                </p>
                <button onClick={handleNextSentence}>{t("continueLabel")}</button>
              </div>
            )}
          </div>
        ) : (
          <p>{t("writingSentencesDone")}</p>
        )}
      </section>

      <button onClick={onFinish}>{finishLabel ?? t("backToDashboard")}</button>
    </div>
  );
}
