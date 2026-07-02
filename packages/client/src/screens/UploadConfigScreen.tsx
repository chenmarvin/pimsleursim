import { useState, type ChangeEvent } from "react";
import type { LessonStep, MasteryMap, VocabItem } from "@pimsleursim/shared";
import { extractVocabulary, fetchNextLesson } from "../api/client.js";
import { loadDeck, mergeCatalog } from "../storage/masteryStore.js";

export interface LessonReadyPayload {
  steps: LessonStep[];
  masteryMap: MasteryMap;
  sourceLanguage: string;
  targetLanguage: string;
}

interface Props {
  onLessonReady: (payload: LessonReadyPayload) => void;
}

export function UploadConfigScreen({ onLessonReady }: Props) {
  const [rawText, setRawText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("ja");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      const text = await file.text();
      setRawText(text);
      setLoadedFileName(file.name);
      setError(null);
    } catch {
      setError(`Couldn't read "${file.name}" as text.`);
    }
  }

  async function handleStart() {
    if (!rawText.trim()) {
      setError("Paste some practice text first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const extraction = await extractVocabulary({
        sourceLanguage,
        targetLanguage,
        rawText,
        maxItems: 20,
      });

      const newVocabItems: VocabItem[] = extraction.items.map((item) => ({
        id: item.id,
        sourceLanguage,
        targetLanguage,
        targetPhrase: item.targetPhrase,
        sourcePhrase: item.sourcePhrase,
        notes: item.notes,
        kanaReading: item.kanaReading,
      }));

      const existingDeck = loadDeck();
      const mergedCatalog = mergeCatalog(existingDeck.catalog, newVocabItems);

      const plan = await fetchNextLesson({
        items: mergedCatalog,
        masteryMap: existingDeck.masteryMap,
      });

      onLessonReady({
        steps: plan.steps,
        masteryMap: plan.updatedMasteryMap,
        sourceLanguage,
        targetLanguage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Pimsleursim</h1>
      <p>Paste practice material in your target language, pick your languages, and start a lesson.</p>
      <div>
        <label>
          Native language (BCP-47, e.g. en, zh-TW):{" "}
          <input value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} />
        </label>
      </div>
      <div>
        <label>
          Target language (BCP-47, e.g. ja, es):{" "}
          <input value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} />
        </label>
      </div>
      <div>
        <label>
          Load a text file: <input type="file" accept=".txt,text/plain" onChange={handleFileSelect} />
        </label>
        {loadedFileName && <span> Loaded "{loadedFileName}".</span>}
      </div>
      <textarea
        rows={10}
        cols={60}
        value={rawText}
        onChange={(e) => {
          setRawText(e.target.value);
          setLoadedFileName(null);
        }}
        placeholder="Paste an article, dialogue, or vocab list in the target language, or load a text file above..."
      />
      <div>
        <button onClick={handleStart} disabled={loading}>
          {loading ? "Preparing lesson..." : "Start lesson"}
        </button>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
