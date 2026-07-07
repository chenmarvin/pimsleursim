import { useState } from "react";
import type { ListeningScript } from "@pimsleursim/shared";
import { speakText as speak } from "../audio/audioPlayer.js";
import { Furigana } from "../components/Furigana.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";

const SLOW_PLAYBACK_RATE = 0.7;

export interface ListeningDrillPayload {
  script: ListeningScript;
  sourceLanguage: string;
  targetLanguage: string;
}

interface Props extends ListeningDrillPayload {
  onFinish: () => void;
  finishLabel?: string;
}

export function ListeningScreen({ script, targetLanguage, onFinish, finishLabel }: Props) {
  const { t } = useUiLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  async function handlePlayAll() {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      // Per the course spec: read once slowly, then again at natural speed.
      for (const line of script.lines) {
        await speak(line.targetText, targetLanguage, SLOW_PLAYBACK_RATE);
      }
      for (const line of script.lines) {
        await speak(line.targetText, targetLanguage);
      }
    } catch (err) {
      console.error("Playback failed", err);
    } finally {
      setIsPlaying(false);
    }
  }

  function toggleReveal(i: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div>
      <h2>{t("listeningScreenTitle")}</h2>
      <button onClick={handlePlayAll} disabled={isPlaying}>
        {isPlaying ? t("listeningPlaying") : t("listeningPlayAll")}
      </button>
      <div>
        {script.lines.map((line, i) => (
          <p key={i}>
            <strong>{line.speaker}:</strong> <Furigana text={line.targetText} segments={line.furigana} />
            <br />
            <span style={{ color: "#555" }}>{line.sourceText}</span>
          </p>
        ))}
      </div>
      <h3>{t("listeningQuestionsLabel")}</h3>
      <ul>
        {script.questions.map((q, i) => (
          <li key={i}>
            {q.question}{" "}
            {revealed.has(i) ? (
              <span>— {q.answer}</span>
            ) : (
              <button onClick={() => toggleReveal(i)}>{t("revealAnswer")}</button>
            )}
          </li>
        ))}
      </ul>
      <button onClick={onFinish}>{finishLabel ?? t("backToDashboard")}</button>
    </div>
  );
}
