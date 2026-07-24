import { useState } from "react";
import type { ScenarioSet } from "@pimsleursim/shared";
import { speakText } from "../audio/audioPlayer.js";
import { Furigana } from "../components/Furigana.js";
import { FuzzyTextEvaluator } from "../evaluation/fuzzyTextEvaluator.js";
import type { ResponseEvaluator } from "../evaluation/ResponseEvaluator.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";

const evaluator: ResponseEvaluator = new FuzzyTextEvaluator();

export type ScenarioMode = "listening" | "writing";

export interface ScenarioDrillPayload {
  set: ScenarioSet;
  sourceLanguage: string;
  targetLanguage: string;
}

interface Props extends ScenarioDrillPayload {
  mode: ScenarioMode;
  onFinish: () => void;
  finishLabel?: string;
}

export function ScenarioScreen({ set, targetLanguage, mode, onFinish, finishLabel }: Props) {
  const { t } = useUiLanguage();
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [typedInput, setTypedInput] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);

  const turn = set.turns[index];
  const primaryResponse = turn?.expectedResponses[0];

  async function handlePlayNpcLine() {
    if (isPlaying || !turn) return;
    setIsPlaying(true);
    try {
      await speakText(turn.npcLine.targetText, targetLanguage);
    } catch (err) {
      console.error("Playback failed", err);
    } finally {
      setIsPlaying(false);
    }
  }

  async function handleReveal() {
    setRevealed(true);
    if (!primaryResponse) return;
    setIsPlaying(true);
    try {
      await speakText(primaryResponse.targetText, targetLanguage);
    } catch (err) {
      console.error("Playback failed", err);
    } finally {
      setIsPlaying(false);
    }
  }

  async function handleSubmitTyped() {
    if (!primaryResponse) return;
    const result = await evaluator.evaluate(typedInput, primaryResponse.targetText, targetLanguage);
    setFeedback({ correct: result.correct });
  }

  function handleNext() {
    setRevealed(false);
    setTypedInput("");
    setFeedback(null);
    setIndex((i) => i + 1);
  }

  if (!turn) {
    return (
      <div>
        <h2>{t("scenarioComplete")}</h2>
        <button onClick={onFinish}>{finishLabel ?? t("backToDashboard")}</button>
      </div>
    );
  }

  const advanced = mode === "listening" ? revealed : feedback !== null;

  return (
    <div>
      <h2>{t("scenarioScreenTitle")}</h2>
      <p>{t("scenarioStepProgress", { current: index + 1, total: set.turns.length })}</p>
      <p style={{ fontStyle: "italic" }}>{turn.situationText}</p>

      <p style={{ fontSize: "1.2em" }}>
        <Furigana text={turn.npcLine.targetText} segments={turn.npcLine.furigana} />{" "}
        <button onClick={handlePlayNpcLine} disabled={isPlaying}>
          {isPlaying ? t("listeningPlaying") : "🔊"}
        </button>
        <br />
        <span style={{ color: "#555" }}>{turn.npcLine.sourceText}</span>
      </p>

      {mode === "listening" ? (
        !revealed ? (
          <div>
            <p>{t("scenarioThinkPrompt")}</p>
            <button onClick={handleReveal} disabled={isPlaying}>
              {t("scenarioReveal")}
            </button>
          </div>
        ) : (
          <div>
            {set.turns[index].expectedResponses.map((response, i) => (
              <p key={i}>
                <Furigana text={response.targetText} segments={response.furigana} />
                <br />
                <span style={{ color: "#555" }}>{response.sourceText}</span>
              </p>
            ))}
          </div>
        )
      ) : (
        <div>
          <p>{t("scenarioWritePrompt")}</p>
          {!feedback ? (
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
          ) : (
            <div>
              <p>{feedback.correct ? t("scenarioCorrect") : t("scenarioIncorrect")}</p>
              {turn.expectedResponses.map((response, i) => (
                <p key={i}>
                  <strong>
                    <Furigana text={response.targetText} segments={response.furigana} />
                  </strong>
                  <br />
                  <span style={{ color: "#555" }}>{response.sourceText}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {advanced && (
        <p>
          <button onClick={handleNext}>{t("continueLabel")}</button>
        </p>
      )}

      <button onClick={onFinish}>{finishLabel ?? t("backToDashboard")}</button>
    </div>
  );
}
