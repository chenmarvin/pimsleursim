import { useMemo, useState } from "react";
import type { LessonReadyPayload } from "./UploadConfigScreen.js";
import type { GrammarDrillPayload } from "./GrammarDrillScreen.js";
import { DEFAULT_SCHEDULER_CONFIG, selectDueReviewItems } from "@pimsleursim/shared";
import { fetchGrammarDrill, fetchNextLesson } from "../api/client.js";
import {
  BUILT_MODULES,
  DAILY_SCHEDULE_TEMPLATES,
  JLPT_PHASE_ORDER,
  JLPT_PHASE_TARGETS,
  type DailyModuleKey,
  type JlptPhase,
} from "../japanese/curriculum.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";
import type { StringKey } from "../i18n/strings.js";
import { loadGrammarProgress } from "../storage/grammarProgressStore.js";
import { loadJapaneseMode, saveJapaneseMode } from "../storage/japaneseModeStore.js";
import { loadDeck } from "../storage/masteryStore.js";

const JAPANESE_TARGET_LANGUAGE = "ja";
const DEFAULT_SOURCE_LANGUAGE = "zh-TW";

const NON_VOCAB_LABEL_KEYS: Partial<Record<DailyModuleKey, StringKey>> = {
  grammar: "moduleGrammar",
  reading: "moduleReading",
  listening: "moduleListening",
};

interface DashboardRow {
  key: string;
  labelKey: StringKey;
  minutes: number;
  isVocab: boolean;
  isGrammar: boolean;
  isBuilt: boolean;
}

function buildRows(allocations: { module: DailyModuleKey; minutes: number }[]): DashboardRow[] {
  const rows: DashboardRow[] = [];
  let vocabMinutes = 0;
  for (const { module, minutes } of allocations) {
    if (module === "vocabReview" || module === "vocabNew") {
      vocabMinutes += minutes;
      continue;
    }
    rows.push({
      key: module,
      labelKey: NON_VOCAB_LABEL_KEYS[module]!,
      minutes,
      isVocab: false,
      isGrammar: module === "grammar",
      isBuilt: BUILT_MODULES.has(module),
    });
  }
  if (vocabMinutes > 0) {
    rows.unshift({ key: "vocab", labelKey: "moduleVocab", minutes: vocabMinutes, isVocab: true, isGrammar: false, isBuilt: true });
  }
  return rows;
}

interface Props {
  onStartPractice: (payload: LessonReadyPayload) => void;
  onStartGrammar: (payload: GrammarDrillPayload) => void;
  onGoToUpload: () => void;
}

function mostCommonSourceLanguage(items: { sourceLanguage: string }[]): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.sourceLanguage, (counts.get(item.sourceLanguage) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best ?? DEFAULT_SOURCE_LANGUAGE;
}

export function DashboardScreen({ onStartPractice, onStartGrammar, onGoToUpload }: Props) {
  const { t } = useUiLanguage();
  const [japaneseMode, setJapaneseMode] = useState(loadJapaneseMode);
  const [selectedMinutes, setSelectedMinutes] = useState(DAILY_SCHEDULE_TEMPLATES[0].totalMinutes);
  const [loading, setLoading] = useState(false);
  const [grammarLoading, setGrammarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deck = useMemo(() => loadDeck(), []);
  const japaneseItems = useMemo(
    () => deck.catalog.filter((item) => item.targetLanguage === JAPANESE_TARGET_LANGUAGE),
    [deck.catalog],
  );
  const dueCount = useMemo(
    () => selectDueReviewItems(deck.masteryMap, new Date(), Number.POSITIVE_INFINITY).length,
    [deck.masteryMap],
  );
  const grammarProgress = useMemo(() => loadGrammarProgress(), []);

  const template =
    DAILY_SCHEDULE_TEMPLATES.find((tpl) => tpl.totalMinutes === selectedMinutes) ?? DAILY_SCHEDULE_TEMPLATES[0];

  const currentPhaseIndex = JLPT_PHASE_ORDER.indexOf(japaneseMode.currentPhase);
  const nextPhase: JlptPhase | null = JLPT_PHASE_ORDER[currentPhaseIndex + 1] ?? null;
  const targets = JLPT_PHASE_TARGETS[japaneseMode.currentPhase];

  function setPhase(phase: JlptPhase) {
    const next = { ...japaneseMode, currentPhase: phase };
    setJapaneseMode(next);
    saveJapaneseMode(next);
  }

  function handleAdvancePhase() {
    if (!nextPhase) return;
    if (!window.confirm(t("confirmAdvancePhase", { phase: nextPhase }))) return;
    setPhase(nextPhase);
  }

  async function handleStartPractice() {
    if (japaneseItems.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const plan = await fetchNextLesson({
        items: japaneseItems,
        masteryMap: deck.masteryMap,
        config: DEFAULT_SCHEDULER_CONFIG,
      });
      onStartPractice({
        steps: plan.steps,
        masteryMap: plan.updatedMasteryMap,
        sourceLanguage: mostCommonSourceLanguage(japaneseItems),
        targetLanguage: JAPANESE_TARGET_LANGUAGE,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  async function handleStartGrammar() {
    setGrammarLoading(true);
    setError(null);
    try {
      const sourceLanguage = mostCommonSourceLanguage(japaneseItems);
      const { point } = await fetchGrammarDrill({
        sourceLanguage,
        targetLanguage: JAPANESE_TARGET_LANGUAGE,
        difficultyHint: `JLPT ${japaneseMode.currentPhase}`,
        coveredPatterns: loadGrammarProgress().coveredPatterns,
      });
      onStartGrammar({ point, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setGrammarLoading(false);
    }
  }

  return (
    <div>
      <h1>{t("dashboardTitle")}</h1>

      <section>
        <p>{t("currentPhase", { phase: japaneseMode.currentPhase })}</p>
        <p>
          {t("phaseTargets", {
            phase: japaneseMode.currentPhase,
            vocab: targets.vocab,
            kanji: targets.kanji,
            grammar: targets.grammar,
          })}
        </p>
        {nextPhase && <button onClick={handleAdvancePhase}>{t("advanceToPhase", { phase: nextPhase })}</button>}
        <div>
          <label>
            {t("changePhaseLabel")}{" "}
            <select value={japaneseMode.currentPhase} onChange={(e) => setPhase(e.target.value as JlptPhase)}>
              {JLPT_PHASE_ORDER.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section>
        <label>
          {t("timeBudgetLabel")}{" "}
          <select value={selectedMinutes} onChange={(e) => setSelectedMinutes(Number(e.target.value))}>
            {DAILY_SCHEDULE_TEMPLATES.map((tpl) => (
              <option key={tpl.totalMinutes} value={tpl.totalMinutes}>
                {t("timeBudgetMinutes", { minutes: tpl.totalMinutes })}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <p>{t("catalogStatus", { count: japaneseItems.length, due: dueCount })}</p>
        <p>{t("grammarProgressLine", { count: grammarProgress.coveredPatterns.length, target: targets.grammar })}</p>
        <ul>
          {buildRows(template.allocations).map((row) => (
            <li key={row.key}>
              {t(row.labelKey)} — {t("moduleMinutes", { minutes: row.minutes })}{" "}
              {row.isVocab ? (
                <button onClick={handleStartPractice} disabled={loading || japaneseItems.length === 0}>
                  {t("startPractice")}
                </button>
              ) : row.isGrammar ? (
                <button onClick={handleStartGrammar} disabled={grammarLoading}>
                  {grammarLoading ? t("grammarLoading") : t("startPractice")}
                </button>
              ) : (
                !row.isBuilt && <span>({t("comingSoon")})</span>
              )}
            </li>
          ))}
        </ul>
        {japaneseItems.length === 0 && (
          <p>
            {t("emptyCatalogPrompt")} <button onClick={onGoToUpload}>{t("goToUpload")}</button>
          </p>
        )}
        {error && <p style={{ color: "red" }}>{error}</p>}
      </section>

      <button onClick={onGoToUpload}>{t("goToUpload")}</button>
    </div>
  );
}
