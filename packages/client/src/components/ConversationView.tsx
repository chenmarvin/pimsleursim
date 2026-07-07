import { useState } from "react";
import type { ConversationLine, VocabItem } from "@pimsleursim/shared";
import { generateConversation } from "../api/client.js";
import { speakText } from "../audio/audioPlayer.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";
import { Furigana } from "./Furigana.js";

interface Props {
  /** Read lazily (only when the learner asks for a conversation) so the catalog reflects the latest merge. */
  getVocab: () => VocabItem[];
  sourceLanguage: string;
  targetLanguage: string;
}

export function ConversationView({ getVocab, sourceLanguage, targetLanguage }: Props) {
  const { t } = useUiLanguage();
  const [lines, setLines] = useState<ConversationLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRepeating, setIsRepeating] = useState(false);

  async function handleGenerate() {
    const items = getVocab();
    if (items.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateConversation({ items, sourceLanguage, targetLanguage });
      setLines(result.lines);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRepeatLine(text: string) {
    if (isRepeating) return;
    setIsRepeating(true);
    try {
      await speakText(text, targetLanguage);
    } catch (err) {
      console.error("Repeat playback failed", err);
    } finally {
      setIsRepeating(false);
    }
  }

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? t("generatingConversation") : t("generateConversation")}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {lines && (
        <div>
          {lines.map((line, i) => (
            <p key={i}>
              <strong>{line.speaker}:</strong> <Furigana text={line.targetText} segments={line.furigana} />{" "}
              <button onClick={() => handleRepeatLine(line.targetText)} disabled={isRepeating}>
                {t("repeat")}
              </button>
              <br />
              <span style={{ color: "#555" }}>{line.sourceText}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
