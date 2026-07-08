import { useRef, useState } from "react";
import {
  DEFAULT_SCHEDULER_CONFIG,
  N5_LESSON_COUNT,
  N5_SYLLABUS,
  type KanjiEntry,
  type ReviewFocus,
} from "@pimsleursim/shared";
import {
  fetchListeningDrill,
  fetchN5GrammarContent,
  fetchN5KanjiContent,
  fetchN5VocabContent,
  fetchNextLesson,
  fetchQuiz,
  fetchReadingDrill,
  fetchShadowingSet,
  fetchWritingSentences,
} from "../api/client.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";
import type { StringKey } from "../i18n/strings.js";
import { mostCommonSourceLanguage } from "../japanese/sourceLanguage.js";
import { loadDeck, mergeCatalog } from "../storage/masteryStore.js";
import {
  cacheLessonContent,
  completeLesson,
  getCachedLessonContent,
  loadN5LessonState,
  type N5LessonContent,
} from "../storage/n5LessonStore.js";
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
const DIFFICULTY_HINT = "JLPT N5";

type StageDescriptor =
  | { kind: "vocab" }
  | { kind: "kanji"; index: number }
  | { kind: "kanjiCheck" }
  | { kind: "grammar"; index: number }
  | { kind: "reading" }
  | { kind: "listening" }
  | { kind: "speaking" }
  | { kind: "writing" }
  | { kind: "quiz" };

const MODULE_LABEL_KEYS: Record<string, StringKey> = {
  vocab: "moduleVocab",
  kanji: "moduleKanji",
  grammar: "moduleGrammar",
  reading: "moduleReading",
  listening: "moduleListening",
  speaking: "moduleSpeaking",
  writing: "moduleWriting",
  quiz: "moduleQuiz",
};

type ScreenState =
  | { name: "intro" }
  | { name: "loading" }
  | { name: "vocab"; payload: LessonReadyPayload }
  | { name: "kanji"; payload: KanjiDrillPayload }
  | { name: "kanjiCheck"; entries: KanjiEntry[] }
  | { name: "grammar"; payload: GrammarDrillPayload }
  | { name: "reading"; payload: ReadingDrillPayload }
  | { name: "listening"; payload: ListeningDrillPayload }
  | { name: "speaking"; payload: ShadowingDrillPayload }
  | { name: "writing"; payload: WritingDrillPayload }
  | { name: "quiz"; payload: QuizDrillPayload }
  | { name: "wrapup" }
  | { name: "error"; message: string };

interface ChineseNote {
  label: string;
  note: string;
}

interface Props {
  onFinish: () => void;
}

function buildStages(content: N5LessonContent, isReview: boolean): StageDescriptor[] {
  const stages: StageDescriptor[] = [{ kind: "vocab" }];
  if (!isReview) {
    content.kanji.forEach((_, i) => stages.push({ kind: "kanji", index: i }));
    if (content.kanji.length > 0) stages.push({ kind: "kanjiCheck" });
    content.grammar.forEach((_, i) => stages.push({ kind: "grammar", index: i }));
  }
  stages.push({ kind: "reading" }, { kind: "listening" }, { kind: "speaking" }, { kind: "writing" }, { kind: "quiz" });
  return stages;
}

function checklistModules(stages: StageDescriptor[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const stage of stages) {
    const bucket = stage.kind === "kanjiCheck" ? "kanji" : stage.kind;
    if (!seen.has(bucket)) {
      seen.add(bucket);
      result.push(bucket);
    }
  }
  return result;
}

function collectChineseNotes(content: N5LessonContent): ChineseNote[] {
  const notes: ChineseNote[] = [];
  for (const item of content.vocab) if (item.chineseDifference) notes.push({ label: item.targetPhrase, note: item.chineseDifference });
  for (const entry of content.kanji) if (entry.chineseDifference) notes.push({ label: entry.character, note: entry.chineseDifference });
  for (const point of content.grammar) if (point.chineseDifference) notes.push({ label: point.patternName, note: point.chineseDifference });
  return notes;
}

function buildReviewFocus(lessonNumbers: number[]): ReviewFocus {
  const vocabulary: string[] = [];
  const grammarPatterns: string[] = [];
  for (const lessonNumber of lessonNumbers) {
    const cached = getCachedLessonContent(lessonNumber);
    if (!cached) continue;
    vocabulary.push(...cached.vocab.map((item) => item.targetPhrase));
    grammarPatterns.push(...cached.grammar.map((point) => point.patternName));
  }
  return { vocabulary, grammarPatterns };
}

interface KanjiCheckProps {
  entries: KanjiEntry[];
  onFinish: () => void;
  finishLabel: string;
}

// REQ-18: a mini reading-check combining this lesson's kanji into words already
// introduced (the "words using it" lists generated alongside each kanji entry).
function KanjiCheckScreen({ entries, onFinish, finishLabel }: KanjiCheckProps) {
  const { t } = useUiLanguage();
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const words = entries.flatMap((entry) => entry.words);

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
      <h2>{t("kanjiReviewLabel")}</h2>
      <p>{t("n5KanjiCheckPrompt")}</p>
      <ul>
        {words.map((word, i) => (
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
      <button onClick={onFinish}>{finishLabel}</button>
    </div>
  );
}

export function N5LessonScreen({ onFinish }: Props) {
  const { t } = useUiLanguage();
  const [lessonNumber] = useState(() => loadN5LessonState().currentLessonNumber);
  const lessonSpec = N5_SYLLABUS[lessonNumber - 1];

  const [screen, setScreen] = useState<ScreenState>({ name: "intro" });
  const [stages, setStages] = useState<StageDescriptor[]>([]);
  const [stageIndex, setStageIndex] = useState(0);
  const contentRef = useRef<N5LessonContent>({ vocab: [], kanji: [], grammar: [] });
  const reviewFocusRef = useRef<ReviewFocus | undefined>(undefined);

  if (!lessonSpec) {
    return (
      <div>
        <h2>{t("n5CurriculumComplete")}</h2>
        <button onClick={onFinish}>{t("backToDashboard")}</button>
      </div>
    );
  }

  async function ensureContentLoaded(): Promise<N5LessonContent> {
    const cached = getCachedLessonContent(lessonNumber);
    if (cached) return cached;

    const deck = loadDeck();
    const japaneseItems = deck.catalog.filter((item) => item.targetLanguage === JAPANESE_TARGET_LANGUAGE);
    const sourceLanguage = mostCommonSourceLanguage(japaneseItems);

    const [vocabRes, kanjiRes, grammarRes] = await Promise.all([
      lessonSpec.vocab.length > 0
        ? fetchN5VocabContent({ sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE, seeds: lessonSpec.vocab })
        : Promise.resolve({ items: [] }),
      lessonSpec.kanji.length > 0
        ? fetchN5KanjiContent({ sourceLanguage, seeds: lessonSpec.kanji })
        : Promise.resolve({ entries: [] }),
      lessonSpec.grammar.length > 0
        ? fetchN5GrammarContent({ sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE, seeds: lessonSpec.grammar })
        : Promise.resolve({ points: [] }),
    ]);

    const content: N5LessonContent = { vocab: vocabRes.items, kanji: kanjiRes.entries, grammar: grammarRes.points };
    if (content.vocab.length > 0) mergeCatalog(deck.catalog, content.vocab);
    cacheLessonContent(lessonNumber, content);
    return content;
  }

  async function advanceToStage(i: number, stageList: StageDescriptor[]) {
    if (i >= stageList.length) {
      completeLesson(lessonNumber);
      setScreen({ name: "wrapup" });
      return;
    }

    setStageIndex(i);
    setScreen({ name: "loading" });
    try {
      const deck = loadDeck();
      const japaneseItems = deck.catalog.filter((item) => item.targetLanguage === JAPANESE_TARGET_LANGUAGE);
      const sourceLanguage = mostCommonSourceLanguage(japaneseItems);
      const reviewFocus = reviewFocusRef.current;
      const content = contentRef.current;
      const stage = stageList[i];

      switch (stage.kind) {
        case "vocab": {
          const plan = await fetchNextLesson({
            items: japaneseItems,
            masteryMap: deck.masteryMap,
            config: {
              ...DEFAULT_SCHEDULER_CONFIG,
              maxNewItemsPerLesson: lessonSpec.isReview
                ? 0
                : content.vocab.length || DEFAULT_SCHEDULER_CONFIG.maxNewItemsPerLesson,
            },
          });
          setScreen({
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
          const entry = content.kanji[stage.index];
          setScreen({ name: "kanji", payload: { entry, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "kanjiCheck": {
          setScreen({ name: "kanjiCheck", entries: content.kanji });
          break;
        }
        case "grammar": {
          const point = content.grammar[stage.index];
          setScreen({ name: "grammar", payload: { point, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "reading": {
          const { passage } = await fetchReadingDrill({
            sourceLanguage,
            targetLanguage: JAPANESE_TARGET_LANGUAGE,
            difficultyHint: DIFFICULTY_HINT,
            reviewFocus,
          });
          setScreen({ name: "reading", payload: { passage, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "listening": {
          const { script } = await fetchListeningDrill({
            sourceLanguage,
            targetLanguage: JAPANESE_TARGET_LANGUAGE,
            difficultyHint: DIFFICULTY_HINT,
            reviewFocus,
          });
          setScreen({ name: "listening", payload: { script, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "speaking": {
          const { set } = await fetchShadowingSet({
            sourceLanguage,
            targetLanguage: JAPANESE_TARGET_LANGUAGE,
            difficultyHint: DIFFICULTY_HINT,
          });
          setScreen({ name: "speaking", payload: { set, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "writing": {
          const { sentences } = await fetchWritingSentences({
            sourceLanguage,
            targetLanguage: JAPANESE_TARGET_LANGUAGE,
            difficultyHint: DIFFICULTY_HINT,
            reviewFocus,
          });
          setScreen({ name: "writing", payload: { sentences, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
        case "quiz": {
          const { quiz } = await fetchQuiz({
            sourceLanguage,
            targetLanguage: JAPANESE_TARGET_LANGUAGE,
            difficultyHint: DIFFICULTY_HINT,
            reviewFocus,
          });
          setScreen({ name: "quiz", payload: { quiz, sourceLanguage, targetLanguage: JAPANESE_TARGET_LANGUAGE } });
          break;
        }
      }
    } catch (err) {
      setScreen({ name: "error", message: err instanceof Error ? err.message : t("errorGeneric") });
    }
  }

  async function handleBegin() {
    setScreen({ name: "loading" });
    try {
      let content: N5LessonContent;
      if (lessonSpec.isReview && lessonSpec.reviewsLessons) {
        reviewFocusRef.current = buildReviewFocus(lessonSpec.reviewsLessons);
        content = { vocab: [], kanji: [], grammar: [] };
      } else {
        content = await ensureContentLoaded();
      }
      contentRef.current = content;

      const built = buildStages(content, lessonSpec.isReview);
      setStages(built);
      await advanceToStage(0, built);
    } catch (err) {
      setScreen({ name: "error", message: err instanceof Error ? err.message : t("errorGeneric") });
    }
  }

  function handleStageFinish() {
    void advanceToStage(stageIndex + 1, stages);
  }

  const finishLabel = t("continueLabel");

  if (screen.name === "intro") {
    return (
      <div>
        <h2>
          {lessonSpec.isReview
            ? t("n5ReviewRangeLabel", {
                from: lessonSpec.reviewsLessons?.[0] ?? lessonNumber - 4,
                to: lessonSpec.reviewsLessons?.[3] ?? lessonNumber - 1,
              })
            : t("n5LessonHeader", { number: lessonNumber, total: N5_LESSON_COUNT })}
        </h2>
        {!lessonSpec.isReview && (
          <p>
            <strong>{t("n5LessonThemeLabel")}</strong> {lessonSpec.theme}
          </p>
        )}
        <p>{t("n5LessonObjectivesLabel")}</p>
        <ul>
          {lessonSpec.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
        <button onClick={handleBegin}>{t("n5LessonBegin")}</button>
      </div>
    );
  }

  if (screen.name === "loading") {
    return (
      <div>
        <p>{t("n5LessonLoading")}</p>
      </div>
    );
  }

  if (screen.name === "error") {
    return (
      <div>
        <p style={{ color: "red" }}>{screen.message}</p>
        <button onClick={onFinish}>{t("backToDashboard")}</button>
      </div>
    );
  }

  if (screen.name === "wrapup") {
    const chineseNotes = collectChineseNotes(contentRef.current);
    return (
      <div>
        <h2>{t("n5LessonCompleteTitle", { number: lessonNumber })}</h2>
        <section>
          <h3>{t("n5ReviewChecklistTitle")}</h3>
          <ul>
            {checklistModules(stages).map((kind) => (
              <li key={kind}>✅ {t(MODULE_LABEL_KEYS[kind])}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{t("n5OutcomesTitle")}</h3>
          <ul>
            {lessonSpec.objectives.map((objective) => (
              <li key={objective}>✅ {objective}</li>
            ))}
          </ul>
        </section>
        {chineseNotes.length > 0 && (
          <section>
            <h3>{t("n5ChineseNotesTitle")}</h3>
            <ul>
              {chineseNotes.map((note, i) => (
                <li key={i}>
                  <strong>{note.label}</strong> — {note.note}
                </li>
              ))}
            </ul>
          </section>
        )}
        <button onClick={onFinish}>{t("backToDashboard")}</button>
      </div>
    );
  }

  if (screen.name === "vocab") {
    return (
      <LessonPlayerScreen
        initialSteps={screen.payload.steps}
        initialMasteryMap={screen.payload.masteryMap}
        sourceLanguage={screen.payload.sourceLanguage}
        targetLanguage={screen.payload.targetLanguage}
        onFinish={handleStageFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (screen.name === "kanji") {
    return (
      <KanjiDrillScreen
        entry={screen.payload.entry}
        sourceLanguage={screen.payload.sourceLanguage}
        targetLanguage={screen.payload.targetLanguage}
        onFinish={handleStageFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (screen.name === "kanjiCheck") {
    return <KanjiCheckScreen entries={screen.entries} onFinish={handleStageFinish} finishLabel={finishLabel} />;
  }
  if (screen.name === "grammar") {
    return (
      <GrammarDrillScreen
        point={screen.payload.point}
        sourceLanguage={screen.payload.sourceLanguage}
        targetLanguage={screen.payload.targetLanguage}
        onFinish={handleStageFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (screen.name === "reading") {
    return (
      <ReadingScreen
        passage={screen.payload.passage}
        sourceLanguage={screen.payload.sourceLanguage}
        targetLanguage={screen.payload.targetLanguage}
        onFinish={handleStageFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (screen.name === "listening") {
    return (
      <ListeningScreen
        script={screen.payload.script}
        sourceLanguage={screen.payload.sourceLanguage}
        targetLanguage={screen.payload.targetLanguage}
        onFinish={handleStageFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (screen.name === "speaking") {
    return (
      <ShadowingScreen
        set={screen.payload.set}
        sourceLanguage={screen.payload.sourceLanguage}
        targetLanguage={screen.payload.targetLanguage}
        onFinish={handleStageFinish}
        finishLabel={finishLabel}
      />
    );
  }
  if (screen.name === "writing") {
    return (
      <WritingScreen
        sentences={screen.payload.sentences}
        sourceLanguage={screen.payload.sourceLanguage}
        targetLanguage={screen.payload.targetLanguage}
        onFinish={handleStageFinish}
        finishLabel={finishLabel}
      />
    );
  }
  return (
    <QuizScreen
      quiz={screen.payload.quiz}
      sourceLanguage={screen.payload.sourceLanguage}
      targetLanguage={screen.payload.targetLanguage}
      onFinish={handleStageFinish}
      finishLabel={finishLabel}
    />
  );
}
