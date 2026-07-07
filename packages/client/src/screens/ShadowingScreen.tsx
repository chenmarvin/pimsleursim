import { useState } from "react";
import type { ShadowingSet } from "@pimsleursim/shared";
import { speakText as speak } from "../audio/audioPlayer.js";
import { Furigana } from "../components/Furigana.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";

const REPEAT_COUNT = 3;

export interface ShadowingDrillPayload {
  set: ShadowingSet;
  sourceLanguage: string;
  targetLanguage: string;
}

interface Props extends ShadowingDrillPayload {
  onFinish: () => void;
  finishLabel?: string;
}

export function ShadowingScreen({ set, targetLanguage, onFinish, finishLabel }: Props) {
  const { t } = useUiLanguage();
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hideText, setHideText] = useState(false);
  const [repeatsDone, setRepeatsDone] = useState(0);

  const line = set.lines[index];

  async function handleRepeat() {
    if (isPlaying || !line) return;
    setIsPlaying(true);
    try {
      for (let i = 0; i < REPEAT_COUNT; i++) {
        await speak(line.targetText, targetLanguage);
      }
      setRepeatsDone(REPEAT_COUNT);
    } catch (err) {
      console.error("Playback failed", err);
    } finally {
      setIsPlaying(false);
    }
  }

  function handleNext() {
    setHideText(false);
    setRepeatsDone(0);
    setIndex((i) => i + 1);
  }

  if (!line) {
    return (
      <div>
        <h2>{t("shadowingComplete")}</h2>
        <button onClick={onFinish}>{finishLabel ?? t("backToDashboard")}</button>
      </div>
    );
  }

  return (
    <div>
      <h2>{t("shadowingScreenTitle")}</h2>
      <p>{t("shadowingStepProgress", { current: index + 1, total: set.lines.length })}</p>
      <p>{t("shadowingGoal")}</p>

      {hideText ? (
        <p style={{ fontStyle: "italic", color: "#888" }}>{t("shadowingHidden")}</p>
      ) : (
        <p style={{ fontSize: "1.2em" }}>
          <Furigana text={line.targetText} segments={line.furigana} />
          <br />
          <span style={{ color: "#555" }}>{line.sourceText}</span>
        </p>
      )}

      <button onClick={handleRepeat} disabled={isPlaying}>
        {isPlaying ? t("listeningPlaying") : t("shadowingRepeat3x")}
      </button>{" "}
      <button onClick={() => setHideText((h) => !h)}>
        {hideText ? t("shadowingShowText") : t("shadowingHideText")}
      </button>

      {repeatsDone > 0 && (
        <p>
          <button onClick={handleNext}>{t("continueLabel")}</button>
        </p>
      )}
    </div>
  );
}
