export type ItemId = string;

// One contiguous run of a target-language string, for furigana display.
// Concatenating every segment's `text`, in order, reconstructs the original
// string exactly. `reading` is present only for segments that contain kanji.
export interface FuriganaSegment {
  text: string;
  reading?: string;
}

export interface VocabItem {
  id: ItemId;
  sourceLanguage: string; // BCP-47, e.g. "zh-TW"
  targetLanguage: string; // BCP-47, e.g. "ja"
  targetPhrase: string;
  sourcePhrase: string;
  notes?: string;
  kanaReading?: string; // hiragana reading, populated for Japanese vocab
  alternateReadings?: string[]; // other commonly-accepted hiragana readings, e.g. 七 -> ["なな"] alongside kanaReading "しち"
  furigana?: FuriganaSegment[]; // segmented targetPhrase, for inline furigana display
  englishTranslation?: string; // English gloss, kept alongside sourcePhrase regardless of the learner's native language
  exampleSentence?: string; // a short example sentence using targetPhrase
  exampleTranslation?: string; // translation of exampleSentence into the learner's native language
  exampleFurigana?: FuriganaSegment[]; // segmented exampleSentence, for inline furigana display
  commonMistake?: string; // a common mistake learners make with this word, in the learner's native language
  memoryTip?: string; // a mnemonic/memory aid, in the learner's native language
  // "False friend" note vs. Chinese, for learners whose native language uses Chinese characters.
  // Omitted when there's no meaningful difference (e.g. targetPhrase has no Chinese-character overlap).
  chineseDifference?: string;
}

export type ItemLifecycleStage = "new" | "in_lesson" | "graduated" | "mastered";

export interface MasteryState {
  itemId: ItemId;
  stage: ItemLifecycleStage;
  inLessonOffsetStage: number; // index into IN_LESSON_RETEST_OFFSETS, -1 if not in_lesson
  longIntervalIndex: number; // index into LONG_INTERVAL_STAGES_MS, -1 if not graduated
  dueAt: string | null; // ISO timestamp; null while stage is "new" or "in_lesson"
  consecutiveCorrect: number;
  consecutiveWrong: number;
  totalReviews: number;
  lastResult: "correct" | "incorrect" | null;
  lastSeenAt: string | null;
}

export type MasteryMap = Record<ItemId, MasteryState>;

export type LessonStepType = "introduce" | "anticipate";

export interface LessonStep {
  stepIndex: number;
  type: LessonStepType;
  itemId: ItemId;
  targetPhrase: string;
  sourcePhrase: string;
  kanaReading?: string; // hiragana reading, populated for Japanese vocab
  alternateReadings?: string[]; // other commonly-accepted hiragana readings, e.g. 七 -> ["なな"] alongside kanaReading "しち"
  furigana?: FuriganaSegment[]; // segmented targetPhrase, for inline furigana display
  englishTranslation?: string; // English gloss, kept alongside sourcePhrase regardless of the learner's native language
  exampleSentence?: string; // a short example sentence using targetPhrase
  exampleTranslation?: string; // translation of exampleSentence into the learner's native language
  exampleFurigana?: FuriganaSegment[]; // segmented exampleSentence, for inline furigana display
  commonMistake?: string; // a common mistake learners make with this word, in the learner's native language
  memoryTip?: string; // a mnemonic/memory aid, in the learner's native language
  // "False friend" note vs. Chinese, for learners whose native language uses Chinese characters.
  // Omitted when there's no meaningful difference (e.g. targetPhrase has no Chinese-character overlap).
  chineseDifference?: string;
}

export interface SchedulerConfig {
  maxNewItemsPerLesson: number;
  maxStepsPerLesson: number;
  reviewToNewRatio: number;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxNewItemsPerLesson: 12,
  maxStepsPerLesson: 80,
  reviewToNewRatio: 3,
};

// ---- API DTOs ----

export interface ExtractRequest {
  sourceLanguage: string;
  targetLanguage: string;
  rawText: string;
  maxItems: number;
}

export interface ExtractedItem {
  id: string;
  targetPhrase: string;
  sourcePhrase: string;
  notes?: string;
  kanaReading?: string; // hiragana reading, populated for Japanese vocab
  alternateReadings?: string[]; // other commonly-accepted hiragana readings, e.g. 七 -> ["なな"] alongside kanaReading "しち"
  furigana?: FuriganaSegment[]; // segmented targetPhrase, for inline furigana display
  englishTranslation?: string; // English gloss, kept alongside sourcePhrase regardless of the learner's native language
  exampleSentence?: string; // a short example sentence using targetPhrase
  exampleTranslation?: string; // translation of exampleSentence into the learner's native language
  exampleFurigana?: FuriganaSegment[]; // segmented exampleSentence, for inline furigana display
  commonMistake?: string; // a common mistake learners make with this word, in the learner's native language
  memoryTip?: string; // a mnemonic/memory aid, in the learner's native language
  // "False friend" note vs. Chinese, for learners whose native language uses Chinese characters.
  // Omitted when there's no meaningful difference (e.g. targetPhrase has no Chinese-character overlap).
  chineseDifference?: string;
}

export interface ExtractResponse {
  items: ExtractedItem[];
  truncated: boolean;
  processedCharCount: number;
  totalCharCount: number;
}

export interface LessonPlanRequest {
  items: VocabItem[];
  masteryMap: MasteryMap;
  config?: Partial<SchedulerConfig>;
}

export interface LessonPlanResponse {
  steps: LessonStep[];
  updatedMasteryMap: MasteryMap;
}

export interface ConversationLine {
  speaker: string; // e.g. "A" / "B" — not a specific character name
  targetText: string;
  sourceText: string; // idiomatic translation of targetText
  furigana?: FuriganaSegment[]; // segmented targetText, for inline furigana display
}

export interface ConversationRequest {
  items: VocabItem[]; // catalog to draw vocabulary from
  sourceLanguage: string;
  targetLanguage: string;
}

export interface ConversationResponse {
  lines: ConversationLine[];
}

export interface ListeningQuestion {
  question: string; // comprehension question, in the learner's native language
  answer: string; // answer, in the learner's native language
}

export interface ListeningScript {
  lines: ConversationLine[]; // the script/transcript, shown to the learner (not hidden)
  questions: ListeningQuestion[];
}

// Only set for N5 review lessons: previously-taught words/patterns to weave into
// generated content, instead of inventing unrelated material (see REQ-11).
export interface ReviewFocus {
  vocabulary: string[];
  grammarPatterns: string[];
}

export interface ListeningDrillRequest {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string; // free-form, e.g. "JLPT N5"
  reviewFocus?: ReviewFocus;
}

export interface ListeningDrillResponse {
  script: ListeningScript;
}

export interface ReadingQuestion {
  question: string; // comprehension question, in the learner's native language
  answer: string; // answer, in the learner's native language
}

export interface ReadingPassage {
  passage: string; // the passage, in the target language
  passageTranslation: string; // translation of the passage into the learner's native language
  furigana?: FuriganaSegment[]; // segmented passage, for inline furigana display
  questions: ReadingQuestion[];
}

export interface ReadingDrillRequest {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string; // free-form, e.g. "JLPT N5"
  reviewFocus?: ReviewFocus;
}

export interface ReadingDrillResponse {
  passage: ReadingPassage;
}

export interface GrammarSentence {
  label: string; // e.g. "Affirmative, present"
  targetText: string;
  sourceText: string;
  furigana?: FuriganaSegment[]; // segmented targetText, for inline furigana display
}

export interface GrammarPoint {
  patternName: string;
  explanation: string; // one or two sentences, in the learner's native language
  structure: string; // concise notation of the grammar structure, e.g. "A は B です"
  sentences: GrammarSentence[];
  // a common mistake learners (especially from the learner's native-language background) make with
  // this pattern, in the learner's native language. Omitted when there isn't a notable one.
  commonMistake?: string;
  // "False friend" note vs. Chinese grammar/usage, for learners whose native language uses Chinese.
  // Omitted when there's no meaningful difference worth flagging.
  chineseDifference?: string;
}

export interface GrammarDrillRequest {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string; // free-form, e.g. "JLPT N5"
  coveredPatterns: string[]; // pattern names already drilled, to avoid repeats
}

export interface GrammarDrillResponse {
  point: GrammarPoint;
}

export interface KanjiWordExample {
  word: string; // a common word using this character
  reading: string; // hiragana reading of the word
  meaning: string; // in the learner's native language
}

export interface KanjiEntry {
  character: string;
  meaning: string; // core meaning(s), in the learner's native language
  onReadings: string[]; // on-yomi, in katakana
  kunReadings: string[]; // kun-yomi, in hiragana
  words: KanjiWordExample[];
  exampleSentence: string;
  exampleSentenceTranslation: string;
  exampleSentenceFurigana?: FuriganaSegment[];
  strokeOrderTip: string; // in the learner's native language
  // "False friend" note vs. the corresponding Chinese hanzi, for learners whose
  // native language uses Chinese characters. Omitted when there's no meaningful difference.
  chineseDifference?: string;
}

export interface KanjiDrillRequest {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string; // free-form, e.g. "JLPT N5"
  coveredKanji: string[]; // characters already drilled, to avoid repeats
}

export interface KanjiDrillResponse {
  entry: KanjiEntry;
}

export type QuizPillar = "vocabulary" | "grammar" | "reading" | "kanji";
export type QuizQuestionType = "multiple_choice" | "fill_in_blank" | "listening";

export interface QuizQuestion {
  pillar: QuizPillar;
  type: QuizQuestionType;
  prompt: string; // question/instructions, in the learner's native language
  audioText?: string; // present only when type === "listening": target-language text read aloud via TTS before the question
  options?: string[]; // present only when type === "multiple_choice"
  answer: string; // correct answer (for multiple_choice, matches one of options)
}

export interface QuizSet {
  questions: QuizQuestion[]; // one per pillar
}

export interface QuizDrillRequest {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string; // free-form, e.g. "JLPT N5"
  reviewFocus?: ReviewFocus;
}

export interface QuizDrillResponse {
  quiz: QuizSet;
}

export interface ShadowingLine {
  targetText: string;
  sourceText: string;
  furigana?: FuriganaSegment[];
}

export interface ShadowingSet {
  lines: ShadowingLine[]; // exactly 3, per the shadowing spec (repeat each 3x)
}

export interface ShadowingDrillRequest {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
}

export interface ShadowingDrillResponse {
  set: ShadowingSet;
}

// One line of dialogue in a scenario turn — either the NPC's line or one of
// the learner's acceptable responses.
export interface ScenarioLine {
  targetText: string;
  sourceText: string;
  furigana?: FuriganaSegment[];
}

export interface ScenarioTurn {
  situationText: string; // framing shown once per turn, in the learner's native language
  npcLine: ScenarioLine;
  expectedResponses: ScenarioLine[]; // 1-2 acceptable answers for this turn
}

export interface ScenarioSet {
  scenarioTitle: string;
  turns: ScenarioTurn[];
}

export interface ScenarioDrillRequest {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
  vocab?: VocabItem[];
}

export interface ScenarioDrillResponse {
  set: ScenarioSet;
}

export interface WritingSentence {
  sourceText: string; // translation prompt, in the learner's native language
  targetText: string; // expected answer, in the target language
  furigana?: FuriganaSegment[];
}

export interface WritingDrillRequest {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
  reviewFocus?: ReviewFocus;
}

export interface WritingDrillResponse {
  sentences: WritingSentence[]; // 5-10 sentences to translate
}

export interface TTSRequest {
  text: string;
  languageCode: string;
  voice?: string;
}

export interface TTSResponse {
  // null when no TTS provider is configured/credentialed — the client
  // treats this as "skip playback" rather than an error, so the app is
  // still usable text-only without a TTS provider's API key.
  audioBase64: string | null;
  mimeType: string | null;
}
