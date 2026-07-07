import { useState } from "react";
import { speakText as speak } from "../audio/audioPlayer.js";
import { ALL_KANA } from "../japanese/kana.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";
import { markKanaComplete } from "../storage/kanaProgressStore.js";

const TARGET_LANGUAGE = "ja";

interface Props {
  onFinish: () => void;
}

export function KanaScreen({ onFinish }: Props) {
  const { t } = useUiLanguage();
  const [index, setIndex] = useState(0);
  const [isRepeating, setIsRepeating] = useState(false);

  const current = ALL_KANA[index];
  const isLast = index === ALL_KANA.length - 1;

  async function handleRepeat() {
    if (isRepeating) return;
    setIsRepeating(true);
    try {
      await speak(current.hiragana, TARGET_LANGUAGE);
    } catch (err) {
      console.error("Repeat playback failed", err);
    } finally {
      setIsRepeating(false);
    }
  }

  function handleNext() {
    if (isLast) {
      markKanaComplete();
      onFinish();
      return;
    }
    setIndex((i) => i + 1);
  }

  return (
    <div>
      <h2>{t("kanaScreenTitle")}</h2>
      <p>{t("kanaStepProgress", { current: index + 1, total: ALL_KANA.length })}</p>
      <p style={{ fontSize: "4em", margin: "0.2em 0" }}>
        {current.hiragana} {current.katakana}
      </p>
      <p>
        {current.romaji}{" "}
        <button onClick={handleRepeat} disabled={isRepeating}>
          {t("repeat")}
        </button>
      </p>
      <button onClick={handleNext}>{isLast ? t("kanaComplete") : t("continueLabel")}</button>
    </div>
  );
}
