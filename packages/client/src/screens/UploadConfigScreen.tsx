import { useState, type ChangeEvent } from "react";
import type { GrammarPoint, JlptLevel, LessonStep, MasteryMap, VocabItem } from "@pimsleursim/shared";
import { buildGrammarDrillItems, DEFAULT_SCHEDULER_CONFIG, isAtOrBelowJlptLevel, JLPT_LEVELS } from "@pimsleursim/shared";
import { extractVocabulary, fetchNextLesson } from "../api/client.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";
import { loadDeck, mergeCatalog, mergeGrammarPoints } from "../storage/masteryStore.js";

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
  const { t } = useUiLanguage();
  const [rawText, setRawText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("ja");
  const [maxJlptLevel, setMaxJlptLevel] = useState<JlptLevel | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [truncationNotice, setTruncationNotice] = useState<{ processed: number; total: number } | null>(null);
  const [pendingPayload, setPendingPayload] = useState<LessonReadyPayload | null>(null);

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
      setError(t("errorFileRead", { fileName: file.name }));
    }
  }

  async function handleStart() {
    if (!rawText.trim()) {
      setError(t("errorPasteFirst"));
      return;
    }
    setLoading(true);
    setError(null);
    setTruncationNotice(null);
    setPendingPayload(null);
    try {
      const extraction = await extractVocabulary({
        sourceLanguage,
        targetLanguage,
        rawText,
        maxItems: 60,
      });

      const newVocabItems: VocabItem[] = extraction.items.map((item) => ({
        id: item.id,
        sourceLanguage,
        targetLanguage,
        targetPhrase: item.targetPhrase,
        sourcePhrase: item.sourcePhrase,
        notes: item.notes,
        kanaReading: item.kanaReading,
        alternateReadings: item.alternateReadings,
        jlptLevel: item.jlptLevel,
      }));

      const newGrammarPoints: GrammarPoint[] = extraction.grammarPoints.map((gp) => ({
        ...gp,
        sourceLanguage,
        targetLanguage,
      }));

      const existingDeck = loadDeck();
      const mergedCatalog = mergeCatalog(existingDeck.catalog, newVocabItems);
      const mergedGrammarPoints = mergeGrammarPoints(existingDeck.grammarPoints, newGrammarPoints);

      // Filter to the learner's target JLPT level — untagged items always
      // pass, so this narrows down leveled content without hiding anything
      // the extractor couldn't confidently level.
      const filteredVocab =
        maxJlptLevel === "all" ? mergedCatalog : mergedCatalog.filter((item) => isAtOrBelowJlptLevel(item.jlptLevel, maxJlptLevel));
      const filteredGrammarPoints =
        maxJlptLevel === "all" ? mergedGrammarPoints : mergedGrammarPoints.filter((gp) => isAtOrBelowJlptLevel(gp.jlptLevel, maxJlptLevel));

      // Grammar points are drilled through the same scheduler as vocab —
      // buildGrammarDrillItems() expands each pattern's substitution
      // examples into ordinary VocabItem-shaped entries first.
      const allItems: VocabItem[] = [...filteredVocab, ...buildGrammarDrillItems(filteredGrammarPoints)];

      // The default scheduler config caps how many *new* items get
      // introduced in a single lesson plan (maxNewItemsPerLesson) and how
      // many total steps the plan may contain (maxStepsPerLesson), so that
      // a daily/recurring session doesn't dump the whole catalog on the
      // learner at once. But when the learner just uploaded a batch of
      // text, they expect every extracted item to show up in this sitting
      // — so raise both caps to fit the whole merged catalog (each new
      // item costs at most an "introduce" + one first-retest "anticipate"
      // step, hence the x4 buffer to also leave room for interleaved
      // due-review steps).
      const plan = await fetchNextLesson({
        items: allItems,
        masteryMap: existingDeck.masteryMap,
        config: {
          maxNewItemsPerLesson: allItems.length,
          maxStepsPerLesson: Math.max(DEFAULT_SCHEDULER_CONFIG.maxStepsPerLesson, allItems.length * 4),
        },
      });

      const payload: LessonReadyPayload = {
        steps: plan.steps,
        masteryMap: plan.updatedMasteryMap,
        sourceLanguage,
        targetLanguage,
      };

      if (extraction.truncated) {
        // Don't silently drop the tail of a long paste — hold the already-
        // computed lesson and let the learner explicitly acknowledge that
        // only part of their text was analyzed before starting it.
        setPendingPayload(payload);
        setTruncationNotice({ processed: extraction.processedCharCount, total: extraction.totalCharCount });
      } else {
        onLessonReady(payload);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  function handleContinueAfterTruncation() {
    if (pendingPayload) onLessonReady(pendingPayload);
  }

  return (
    <div>
      <h1>{t("appTitle")}</h1>
      <p>{t("appTagline")}</p>
      <div>
        <label>
          {t("nativeLanguageLabel")}{" "}
          <input value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} />
        </label>
      </div>
      <div>
        <label>
          {t("targetLanguageLabel")}{" "}
          <input value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} />
        </label>
      </div>
      {targetLanguage.startsWith("ja") && (
        <div>
          <label>
            {t("jlptLevelLabel")}{" "}
            <select value={maxJlptLevel} onChange={(e) => setMaxJlptLevel(e.target.value as JlptLevel | "all")}>
              <option value="all">{t("jlptLevelAll")}</option>
              {JLPT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div>
        <label>
          {t("loadTextFileLabel")} <input type="file" accept=".txt,text/plain" onChange={handleFileSelect} />
        </label>
        {loadedFileName && <span> {t("loadedFile", { fileName: loadedFileName })}</span>}
      </div>
      <textarea
        rows={10}
        cols={60}
        value={rawText}
        onChange={(e) => {
          setRawText(e.target.value);
          setLoadedFileName(null);
        }}
        placeholder={t("textareaPlaceholder")}
      />
      <div>
        <button onClick={handleStart} disabled={loading}>
          {loading ? t("preparingLesson") : t("startLesson")}
        </button>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {truncationNotice && (
        <p style={{ color: "darkorange" }}>
          {t("warningTruncated", { processed: truncationNotice.processed, total: truncationNotice.total })}{" "}
          <button onClick={handleContinueAfterTruncation}>{t("continueAnyway")}</button>
        </p>
      )}
    </div>
  );
}
