export type ItemId = string;

export interface VocabItem {
  id: ItemId;
  sourceLanguage: string; // BCP-47, e.g. "zh-TW"
  targetLanguage: string; // BCP-47, e.g. "ja"
  targetPhrase: string;
  sourcePhrase: string;
  notes?: string;
  kanaReading?: string; // hiragana reading, populated for Japanese vocab
  alternateReadings?: string[]; // other commonly-accepted hiragana readings, e.g. 七 -> ["なな"] alongside kanaReading "しち"
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
}

export interface ConversationRequest {
  items: VocabItem[]; // catalog to draw vocabulary from
  sourceLanguage: string;
  targetLanguage: string;
}

export interface ConversationResponse {
  lines: ConversationLine[];
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
