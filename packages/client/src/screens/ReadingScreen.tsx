import { useState } from "react";
import type { ReadingPassage } from "@pimsleursim/shared";
import { speakText as speak } from "../audio/audioPlayer.js";
import { Furigana } from "../components/Furigana.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";

export interface ReadingDrillPayload {
  passage: ReadingPassage;
  sourceLanguage: string;
  targetLanguage: string;
}

interface Props extends ReadingDrillPayload {
  onFinish: () => void;
  finishLabel?: string;
}

export function ReadingScreen({ passage, targetLanguage, onFinish, finishLabel }: Props) {
  const { t } = useUiLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  async function handleReadAloud() {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      await speak(passage.passage, targetLanguage);
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
      <h2>{t("readingScreenTitle")}</h2>
      <p style={{ fontSize: "1.2em" }}>
        <Furigana text={passage.passage} segments={passage.furigana} />
      </p>
      <button onClick={handleReadAloud} disabled={isPlaying}>
        {isPlaying ? t("listeningPlaying") : t("readingReadAloud")}
      </button>{" "}
      <button onClick={() => setShowTranslation((s) => !s)}>
        {showTranslation ? t("readingHideTranslation") : t("readingShowTranslation")}
      </button>
      {showTranslation && <p style={{ color: "#555" }}>{passage.passageTranslation}</p>}
      <h3>{t("listeningQuestionsLabel")}</h3>
      <ul>
        {passage.questions.map((q, i) => (
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
