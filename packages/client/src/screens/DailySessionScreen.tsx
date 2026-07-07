import { useMemo, useState } from "react";
import { DEFAULT_SCHEDULER_CONFIG } from "@pimsleursim/shared";
import {
  fetchGrammarDrill,
  fetchKanjiDrill,
  fetchListeningDrill,
  fetchNextLesson,
  fetchQuiz,
  fetchReadingDrill,
  fetchShadowingSet,
  fetchWritingSentences,
} from "../api/client.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";
import type { StringKey } from "../i18n/strings.js";
import { loadGrammarProgress } from "../storage/grammarProgressStore.js";
import { loadJapaneseMode } from "../storage/japaneseModeStore.js";
import { loadKanaProgress } from "../storage/kanaProgressStore.js";
import { loadKanjiProgress } from "../storage/kanjiProgressStore.js";
import { loadDeck } from "../storage/masteryStore.js";
import { incrementCompletedSessions, isReviewSession, loadSessionProgress } from "../storage/sessionProgressStore.js";
import { GrammarDrillScreen, type GrammarDrillPayload } from "./GrammarDrillScreen.js";
import { KanjiDrillScreen, type KanjiDrillPayload } from "./KanjiDrillScreen.js";
import { LessonPlayerScreen } from "./LessonPlayerScreen.js";
import { ListeningScreen, type ListeningDrillPayload } from "./ListeningScreen.js";
import { QuizScreen, type QuizDrillPayload } from "./QuizScreen.js";
import { ReadingScreen, type ReadingDrillPayload } from "./ReadingScreen.js";
import { ShadowingScreen, type ShadowingDrillPayload } from "./ShadowingScreen.js";
import type { LessonReadyPayload } from "./UploadConfigScreen.js";
import { WritingScreen, type WritingDrillPayload } from "./WritingScreen.js";

const JAPANESE_TARGET_LANGUAGE = "ja";
const DEFAULT_SOURCE_LANGUAGE = "zh-TW";

type ModuleKind = "vocab" | "kanji" | "grammar" | "reading" | "listening" | "speaking" | "writing" | "quiz";

const OBJECTIVE_LABEL_KEYS: Record<ModuleKind, StringKey> = {
  vocab: "moduleVocab",
  kanji: "moduleKanji",
  grammar: "moduleGrammar",
  reading: "moduleReading",
  listening: "moduleListening",
  speaking: "moduleSpeaking",
  writing: "moduleWriting",
  quiz: "moduleQuiz",
};

type StepState =
  | { name: "intro" }
  | { name: "loading" }
  | { name: "vocab"; payload: LessonReadyPayload }
  | { name: "kanji"; payload: KanjiDrillPayload }
  | { name: "grammar"; payload: GrammarDrillPayload }
  | { name: "reading"; payload: ReadingDrillPayload }
  | { name: "listening"; payload: ListeningDrillPayload }
  | { name: "speaking"; payload: ShadowingDrillPayload }
  | { name: "writing"; payload: WritingDrillPayload }
  | { name: "quiz"; payload: QuizDrillPayload }
  | { name: "outcomes" }
  | { name: "error"; message: string };

interface Props {
  onFinish: () => void;
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

export function DailySessionScreen({ onFinish }: Props) {
  const { t } = useUiLanguage();
  const [step, setStep] = useState<StepState>({ name: "intro" });
  const [kindIndex, setKindIndex] = useState(0);

  const sessionProgress = useMemo(() => loadSessionProgress(), []);
  const isReview = useMemo(() => isReviewSession(sessionProgress.completedSessions), [sessionProgress]);
  const kanaComplete = useMemo(() => loadKanaProgress().completed, []);

  // Every 5th session is review-only (per REQ-11): no new kanji/grammar is
  // introduced. Vocab still runs, but with new-item introduction capped to 0.
  const kinds: ModuleKind[] = useMemo(() => {
    const list: ModuleKind[] = ["vocab"];
    if (!isReview && kanaComplete) list.push("kanji");
    if (!isReview) list.push("grammar");
    list.push("reading", "listening", "speaking", "writing", "quiz");
    return list;
  }, [isReview, kanaComplete]);

  async function advanceToKind(i: number) {
    if (i >= kinds.length) {
      incrementCompletedSessions();
      setStep({ name: "outcomes" });
      return;
    }

    setStep({ name: "loading" });
    try {
      const deck = loadDeck();
      const japaneseItems = deck.catalog.filter((item) => item.targetLanguage === JAPANESE_TARGET_LANGUAGE);
      const sourceLanguage = mostCommonSourceLanguage(japaneseItems);
      const difficultyHint = `JLPT ${loadJapaneseMode().currentPhase}`;
      const kind = kinds[i];

      switch (kind) {
        case "vocab": {
          const plan = await fetchNextLesson({
            items: japaneseItems,
            masteryMap: deck.masteryMap,
            config: isReview ? { ...DEFAULT_SCHEDULER_CONFIG, maxNewItemsPerLesson: 0 } : DEFAULT_SCHEDULER_CONFIG,
          });
          setStep({
            name: "vocab",
            payload: {
              steps: plan.steps,
              masteryMap: plan.updatedMasteryMap,
              sourceLanguage,
              targetLanguage: JAPANESE_TARGET_LANGUAGE,
            },
          });
          break;
        }
        case "kanji": {
          const { entry } = await fetchKanjiDrill({
            sourceLanguage,
            targetLanguage: JAPANESE_TARGET_LANGUAGE,
            difficultyHint,
            coveredKanji: loadKanjiProgress().coveredKanji,
          });
          setStep({ name: "kanji", payload: { entry, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "grammar": {
          const { point } = await fetchGrammarDrill({
            sourceLanguage,
            targetLanguage: JAPANESE_TARGET_LANGUAGE,
            difficultyHint,
            coveredPatterns: loadGrammarProgress().coveredPatterns,
          });
          setStep({ name: "grammar", payload: { point, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "reading": {
          const { passage } = await fetchReadingDrill({ sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE, difficultyHint });
          setStep({ name: "reading", payload: { passage, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "listening": {
          const { script } = await fetchListeningDrill({ sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE, difficultyHint });
          setStep({ name: "listening", payload: { script, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "speaking": {
          const { set } = await fetchShadowingSet({ sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE, difficultyHint });
          setStep({ name: "speaking", payload: { set, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "writing": {
          const { sentences } = await fetchWritingSentences({ sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE, difficultyHint });
          setStep({ name: "writing", payload: { sentences, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "quiz": {
          const { quiz } = await fetchQuiz({ sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE, difficultyHint });
          setStep({ name: "quiz", payload: { quiz, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
      }
    } catch (err) {
      setStep({ name: "error", message: err instanceof Error ? err.message : t("errorGeneric") });
    }
  }

  function handleStepFinish() {
    const next = kindIndex + 1;
    setKindIndex(next);
    void advanceToKind(next);
  }

  if (step.name === "intro") {
    return (
      <div>
        <h2>{t(isReview ? "sessionReviewTheme" : "sessionTheme")}</h2>
        <p>{t("sessionObjectivesLabel")}</p>
        <ul>
          {kinds.map((kind) => (
            <li key={kind}>{t(OBJECTIVE_LABEL_KEYS[kind])}</li>
          ))}
        </ul>
        <button onClick={() => advanceToKind(0)}>{t("sessionBegin")}</button>
      </div>
    );
  }

  if (step.name === "loading") {
    return (
      <div>
        <p>{t("sessionLoading")}</p>
      </div>
    );
  }

  if (step.name === "error") {
    return (
      <div>
        <p style={{ color: "red" }}>{step.message}</p>
        <button onClick={onFinish}>{t("backToDashboard")}</button>
      </div>
    );
  }

  if (step.name === "outcomes") {
    return (
      <div>
        <h2>{t(isReview ? "sessionReviewOutcomesTitle" : "sessionOutcomesTitle")}</h2>
        <ul>
          {kinds.map((kind) => (
            <li key={kind}>✅ {t(OBJECTIVE_LABEL_KEYS[kind])}</li>
          ))}
        </ul>
        <button onClick={onFinish}>{t("backToDashboard")}</button>
      </div>
    );
  }

  const finishLabel = t("continueLabel");

  if (step.name === "vocab") {
    return (
      <LessonPlayerScreen
        initialSteps={step.payload.steps}
        initialMasteryMap={step.payload.masteryMap}
        sourceLanguage={step.payload.sourceLanguage}
        targetLanguage={step.payload.targetLanguage}
        onFinish={handleStepFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (step.name === "kanji") {
    return (
      <KanjiDrillScreen
        entry={step.payload.entry}
        sourceLanguage={step.payload.sourceLanguage}
        targetLanguage={step.payload.targetLanguage}
        onFinish={handleStepFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (step.name === "grammar") {
    return (
      <GrammarDrillScreen
        point={step.payload.point}
        sourceLanguage={step.payload.sourceLanguage}
        targetLanguage={step.payload.targetLanguage}
        onFinish={handleStepFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (step.name === "reading") {
    return (
      <ReadingScreen
        passage={step.payload.passage}
        sourceLanguage={step.payload.sourceLanguage}
        targetLanguage={step.payload.targetLanguage}
        onFinish={handleStepFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (step.name === "listening") {
    return (
      <ListeningScreen
        script={step.payload.script}
        sourceLanguage={step.payload.sourceLanguage}
        targetLanguage={step.payload.targetLanguage}
        onFinish={handleStepFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (step.name === "speaking") {
    return (
      <ShadowingScreen
        set={step.payload.set}
        sourceLanguage={step.payload.sourceLanguage}
        targetLanguage={step.payload.targetLanguage}
        onFinish={handleStepFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (step.name === "writing") {
    return (
      <WritingScreen
        sentences={step.payload.sentences}
        sourceLanguage={step.payload.sourceLanguage}
        targetLanguage={step.payload.targetLanguage}
        onFinish={handleStepFinish}
        finishLabel={finishLabel}
      />
    );
  }
  return (
    <QuizScreen
      quiz={step.payload.quiz}
      sourceLanguage={step.payload.sourceLanguage}
      targetLanguage={step.payload.targetLanguage}
      onFinish={handleStepFinish}
      finishLabel={finishLabel}
    />
  );
}
