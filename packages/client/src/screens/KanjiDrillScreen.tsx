import { useState } from "react";
import type { KanjiEntry } from "@pimsleursim/shared";
import { speakText as speak } from "../audio/audioPlayer.js";
import { Furigana } from "../components/Furigana.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";
import { addCoveredKanji } from "../storage/kanjiProgressStore.js";

export interface KanjiDrillPayload {
  entry: KanjiEntry;
  sourceLanguage: string;
  targetLanguage: string;
}

interface Props extends KanjiDrillPayload {
  onFinish: () => void;
  finishLabel?: string;
}

export function KanjiDrillScreen({ entry, targetLanguage, onFinish, finishLabel }: Props) {
  const { t } = useUiLanguage();
  const [isRepeating, setIsRepeating] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  async function handleRepeat() {
    if (isRepeating) return;
    setIsRepeating(true);
    try {
      await speak(entry.exampleSentence, targetLanguage);
    } catch (err) {
      console.error("Repeat playback failed", err);
    } finally {
      setIsRepeating(false);
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

  function handleDone() {
    addCoveredKanji(entry.character);
    onFinish();
  }

  return (
    <div>
      <h2 style={{ fontSize: "2.5em" }}>{entry.character}</h2>
      <p>
        <strong>{t("kanjiMeaningLabel")}</strong> {entry.meaning}
      </p>
      {entry.onReadings.length > 0 && (
        <p>
          <strong>{t("kanjiOnReadingLabel")}</strong> {entry.onReadings.join("、")}
        </p>
      )}
      {entry.kunReadings.length > 0 && (
        <p>
          <strong>{t("kanjiKunReadingLabel")}</strong> {entry.kunReadings.join("、")}
        </p>
      )}
      <div>
        <strong>{t("kanjiWordsLabel")}</strong>
        <ul>
          {entry.words.map((word, i) => (
            <li key={i}>
              {word.word}（{word.reading}）— {word.meaning}
            </li>
          ))}
        </ul>
      </div>
      <p>
        <strong>{t("kanjiExampleLabel")}</strong>{" "}
        <Furigana text={entry.exampleSentence} segments={entry.exampleSentenceFurigana} /> ({entry.exampleSentenceTranslation}){" "}
        <button onClick={handleRepeat} disabled={isRepeating}>
          {t("repeat")}
        </button>
      </p>
      <p>
        <strong>{t("kanjiStrokeOrderLabel")}</strong> {entry.strokeOrderTip}
      </p>
      {entry.chineseDifference && (
        <p>
          <strong>{t("kanjiChineseNoteLabel")}</strong> {entry.chineseDifference}
        </p>
      )}
      <div>
        <strong>{t("kanjiReviewLabel")}</strong>
        <p>{t("kanjiReviewPrompt")}</p>
        <ul>
          {entry.words.map((word, i) => (
            <li key={i}>
              {word.word}{" "}
              {revealed.has(i) ? (
                <span>
                  （{word.reading}）— {word.meaning}
                </span>
              ) : (
                <button onClick={() => toggleReveal(i)}>{t("revealAnswer")}</button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <button onClick={handleDone}>{finishLabel ?? t("backToDashboard")}</button>
    </div>
  );
}
