import { useMemo, useState } from "react";
import type { LessonReadyPayload } from "./UploadConfigScreen.js";
import type { GrammarDrillPayload } from "./GrammarDrillScreen.js";
import type { KanjiDrillPayload } from "./KanjiDrillScreen.js";
import type { ListeningDrillPayload } from "./ListeningScreen.js";
import type { ReadingDrillPayload } from "./ReadingScreen.js";
import type { ScenarioDrillPayload, ScenarioMode } from "./ScenarioScreen.js";
import { DEFAULT_SCHEDULER_CONFIG, N5_LESSON_COUNT, selectDueReviewItems } from "@pimsleursim/shared";
import {
  fetchGrammarDrill,
  fetchKanjiDrill,
  fetchListeningDrill,
  fetchNextLesson,
  fetchReadingDrill,
  fetchScenario,
} from "../api/client.js";
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
import { loadKanaProgress } from "../storage/kanaProgressStore.js";
import { loadKanjiProgress } from "../storage/kanjiProgressStore.js";
import { loadDeck } from "../storage/masteryStore.js";
import { loadN5LessonState } from "../storage/n5LessonStore.js";
import { mostCommonSourceLanguage } from "../japanese/sourceLanguage.js";

const JAPANESE_TARGET_LANGUAGE = "ja";

const NON_VOCAB_LABEL_KEYS: Partial<Record<DailyModuleKey, StringKey>> = {
  grammar: "moduleGrammar",
  kanji: "moduleKanji",
  reading: "moduleReading",
  listening: "moduleListening",
};

interface DashboardRow {
  key: string;
  labelKey: StringKey;
  minutes: number;
  isVocab: boolean;
  isGrammar: boolean;
  isKanji: boolean;
  isListening: boolean;
  isReading: boolean;
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
      isKanji: module === "kanji",
      isListening: module === "listening",
      isReading: module === "reading",
      isBuilt: BUILT_MODULES.has(module),
    });
  }
  if (vocabMinutes > 0) {
    rows.unshift({
      key: "vocab",
      labelKey: "moduleVocab",
      minutes: vocabMinutes,
      isVocab: true,
      isGrammar: false,
      isKanji: false,
      isListening: false,
      isReading: false,
      isBuilt: true,
    });
  }
  return rows;
}

interface Props {
  onStartPractice: (payload: LessonReadyPayload) => void;
  onStartGrammar: (payload: GrammarDrillPayload) => void;
  onStartKanji: (payload: KanjiDrillPayload) => void;
  onStartKana: () => void;
  onStartListening: (payload: ListeningDrillPayload) => void;
  onStartReading: (payload: ReadingDrillPayload) => void;
  onStartScenario: (payload: ScenarioDrillPayload, mode: ScenarioMode) => void;
  onStartSession: () => void;
  onGoToUpload: () => void;
}

export function DashboardScreen({
  onStartPractice,
  onStartGrammar,
  onStartKanji,
  onStartKana,
  onStartListening,
  onStartReading,
  onStartScenario,
  onStartSession,
  onGoToUpload,
}: Props) {
  const { t } = useUiLanguage();
  const [japaneseMode, setJapaneseMode] = useState(loadJapaneseMode);
  const [selectedMinutes, setSelectedMinutes] = useState(DAILY_SCHEDULE_TEMPLATES[0].totalMinutes);
  const [loading, setLoading] = useState(false);
  const [grammarLoading, setGrammarLoading] = useState(false);
  const [kanjiLoading, setKanjiLoading] = useState(false);
  const [listeningLoading, setListeningLoading] = useState(false);
  const [readingLoading, setReadingLoading] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState<ScenarioMode | null>(null);
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
  const kanjiProgress = useMemo(() => loadKanjiProgress(), []);
  const kanaProgress = useMemo(() => loadKanaProgress(), []);
  const n5LessonState = useMemo(() => loadN5LessonState(), []);
  const isN5 = japaneseMode.currentPhase === "N5";
  const n5CurriculumComplete = n5LessonState.currentLessonNumber > N5_LESSON_COUNT;

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

  async function handleStartKanji() {
    setKanjiLoading(true);
    setError(null);
    try {
      const sourceLanguage = mostCommonSourceLanguage(japaneseItems);
      const { entry } = await fetchKanjiDrill({
        sourceLanguage,
        targetLanguage: JAPANESE_TARGET_LANGUAGE,
        difficultyHint: `JLPT ${japaneseMode.currentPhase}`,
        coveredKanji: loadKanjiProgress().coveredKanji,
      });
      onStartKanji({ entry, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setKanjiLoading(false);
    }
  }

  async function handleStartListening() {
    setListeningLoading(true);
    setError(null);
    try {
      const sourceLanguage = mostCommonSourceLanguage(japaneseItems);
      const { script } = await fetchListeningDrill({
        sourceLanguage,
        targetLanguage: JAPANESE_TARGET_LANGUAGE,
        difficultyHint: `JLPT ${japaneseMode.currentPhase}`,
      });
      onStartListening({ script, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setListeningLoading(false);
    }
  }

  async function handleStartReading() {
    setReadingLoading(true);
    setError(null);
    try {
      const sourceLanguage = mostCommonSourceLanguage(japaneseItems);
      const { passage } = await fetchReadingDrill({
        sourceLanguage,
        targetLanguage: JAPANESE_TARGET_LANGUAGE,
        difficultyHint: `JLPT ${japaneseMode.currentPhase}`,
      });
      onStartReading({ passage, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setReadingLoading(false);
    }
  }

  async function handleStartScenario(mode: ScenarioMode) {
    setScenarioLoading(mode);
    setError(null);
    try {
      const sourceLanguage = mostCommonSourceLanguage(japaneseItems);
      const { set } = await fetchScenario({
        sourceLanguage,
        targetLanguage: JAPANESE_TARGET_LANGUAGE,
        difficultyHint: `JLPT ${japaneseMode.currentPhase}`,
        vocab: japaneseItems,
      });
      onStartScenario({ set, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE }, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setScenarioLoading(null);
    }
  }

  return (
    <div>
      <h1>{t("dashboardTitle")}</h1>

      <p>
        {isN5 ? (
          n5CurriculumComplete ? (
            <span>{t("n5CurriculumComplete")}</span>
          ) : (
            <button onClick={onStartSession}>{t("n5StartLesson", { number: n5LessonState.currentLessonNumber })}</button>
          )
        ) : (
          <button onClick={onStartSession}>{t("startFullSession")}</button>
        )}
      </p>

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
        {!kanaProgress.completed && (
          <p>
            {t("kanaGatePrompt")} <button onClick={onStartKana}>{t("startKana")}</button>
          </p>
        )}
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
        {isN5 ? (
          <p>
            {t("n5LessonProgressLine", {
              current: Math.min(n5LessonState.currentLessonNumber, N5_LESSON_COUNT),
              total: N5_LESSON_COUNT,
              completed: n5LessonState.completedLessons.length,
            })}
          </p>
        ) : (
          <>
            <p>{t("grammarProgressLine", { count: grammarProgress.coveredPatterns.length, target: targets.grammar })}</p>
            <p>{t("kanjiProgressLine", { count: kanjiProgress.coveredKanji.length, target: targets.kanji })}</p>
          </>
        )}
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
              ) : row.isKanji ? (
                kanaProgress.completed ? (
                  <button onClick={handleStartKanji} disabled={kanjiLoading}>
                    {kanjiLoading ? t("kanjiLoading") : t("startPractice")}
                  </button>
                ) : (
                  <span>({t("kanaRequiredHint")})</span>
                )
              ) : row.isListening ? (
                <button onClick={handleStartListening} disabled={listeningLoading}>
                  {listeningLoading ? t("listeningLoading") : t("startPractice")}
                </button>
              ) : row.isReading ? (
                <button onClick={handleStartReading} disabled={readingLoading}>
                  {readingLoading ? t("readingLoading") : t("startPractice")}
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

      <section>
        <p>{t("moduleScenario")}</p>
        <button onClick={() => handleStartScenario("listening")} disabled={scenarioLoading !== null}>
          {scenarioLoading === "listening" ? t("scenarioLoading") : t("scenarioListeningLabel")}
        </button>{" "}
        <button onClick={() => handleStartScenario("writing")} disabled={scenarioLoading !== null}>
          {scenarioLoading === "writing" ? t("scenarioLoading") : t("scenarioWritingLabel")}
        </button>
      </section>

      <button onClick={onGoToUpload}>{t("goToUpload")}</button>
    </div>
  );
}
