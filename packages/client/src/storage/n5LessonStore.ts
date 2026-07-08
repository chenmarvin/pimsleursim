import { N5_LESSON_COUNT, type GrammarPoint, type KanjiEntry, type VocabItem } from "@pimsleursim/shared";

const N5_LESSON_STORE_KEY = "pimsleursim.n5Lesson.v1";

export interface N5LessonContent {
  vocab: VocabItem[];
  kanji: KanjiEntry[];
  grammar: GrammarPoint[];
}

export interface N5LessonState {
  currentLessonNumber: number;
  completedLessons: number[];
  lessonContentCache: Record<number, N5LessonContent>;
}

const DEFAULT_STATE: N5LessonState = {
  currentLessonNumber: 1,
  completedLessons: [],
  lessonContentCache: {},
};

export function loadN5LessonState(): N5LessonState {
  const raw = localStorage.getItem(N5_LESSON_STORE_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<N5LessonState>) };
  } catch {
    return DEFAULT_STATE;
  }
}

function save(state: N5LessonState): void {
  localStorage.setItem(N5_LESSON_STORE_KEY, JSON.stringify(state));
}

export function getCachedLessonContent(lessonNumber: number): N5LessonContent | undefined {
  return loadN5LessonState().lessonContentCache[lessonNumber];
}

// Content is generated once per lesson (see N5 discrete-lesson-layer plan) and cached here
// so revisiting a lesson — including a later review lesson re-drilling it — is deterministic.
export function cacheLessonContent(lessonNumber: number, content: N5LessonContent): N5LessonState {
  const current = loadN5LessonState();
  const next: N5LessonState = {
    ...current,
    lessonContentCache: { ...current.lessonContentCache, [lessonNumber]: content },
  };
  save(next);
  return next;
}

export function completeLesson(lessonNumber: number): N5LessonState {
  const current = loadN5LessonState();
  const completedLessons = current.completedLessons.includes(lessonNumber)
    ? current.completedLessons
    : [...current.completedLessons, lessonNumber];
  const next: N5LessonState = {
    ...current,
    completedLessons,
    currentLessonNumber: Math.min(Math.max(current.currentLessonNumber, lessonNumber + 1), N5_LESSON_COUNT),
  };
  save(next);
  return next;
}
