import type {
  ItemId,
  LessonStep,
  MasteryMap,
  MasteryState,
  SchedulerConfig,
  VocabItem,
} from "./types.js";

// Short, in-lesson intervals — tracked by STEP COUNT within the current
// session, approximating Pimsleur's 5s / 25s / 2min / 10min cadence
// (assumes roughly 5-15s per step including audio + typing + reveal).
export const IN_LESSON_RETEST_OFFSETS = [2, 5, 12, 40];

// Long, cross-session intervals — tracked by WALL-CLOCK time via `dueAt`.
export const LONG_INTERVAL_STAGES_MS = [
  60 * 60 * 1000, // 1 hour
  5 * 60 * 60 * 1000, // 5 hours
  24 * 60 * 60 * 1000, // 1 day
  5 * 24 * 60 * 60 * 1000, // 5 days
  25 * 24 * 60 * 60 * 1000, // 25 days
  4 * 30 * 24 * 60 * 60 * 1000, // ~4 months
  2 * 365 * 24 * 60 * 60 * 1000, // ~2 years
];

export function initMasteryState(itemId: ItemId): MasteryState {
  return {
    itemId,
    stage: "new",
    inLessonOffsetStage: -1,
    longIntervalIndex: -1,
    dueAt: null,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    totalReviews: 0,
    lastResult: null,
    lastSeenAt: null,
  };
}

export function isDue(mastery: MasteryState, now: Date): boolean {
  return mastery.stage === "graduated" && mastery.dueAt !== null && new Date(mastery.dueAt) <= now;
}

export function selectDueReviewItems(masteryMap: MasteryMap, now: Date, limit: number): ItemId[] {
  return Object.values(masteryMap)
    .filter((m) => isDue(m, now))
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
    .slice(0, limit)
    .map((m) => m.itemId);
}

/**
 * After a graded `anticipate` step, returns the step-offset (from the
 * current step index) at which the item's next in-lesson retest should be
 * spliced into the queue, or null if the item is no longer in the
 * short-interval ladder (it just graduated, or is on the long ladder).
 */
export function computeInLessonRetestOffset(mastery: MasteryState): number | null {
  if (mastery.stage !== "in_lesson") return null;
  return IN_LESSON_RETEST_OFFSETS[mastery.inLessonOffsetStage] ?? null;
}

export function applyStepResult(mastery: MasteryState, wasCorrect: boolean, now: Date): MasteryState {
  const next: MasteryState = {
    ...mastery,
    totalReviews: mastery.totalReviews + 1,
    lastSeenAt: now.toISOString(),
    lastResult: wasCorrect ? "correct" : "incorrect",
  };

  if (next.stage === "in_lesson") {
    if (wasCorrect) {
      next.consecutiveCorrect += 1;
      next.consecutiveWrong = 0;
      const nextOffsetStage = next.inLessonOffsetStage + 1;
      if (nextOffsetStage >= IN_LESSON_RETEST_OFFSETS.length) {
        // Survived the full 5s -> 25s -> 2min -> 10min ladder this session.
        next.stage = "graduated";
        next.inLessonOffsetStage = -1;
        next.longIntervalIndex = 0;
        next.dueAt = new Date(now.getTime() + LONG_INTERVAL_STAGES_MS[0]).toISOString();
      } else {
        next.inLessonOffsetStage = nextOffsetStage;
      }
    } else {
      next.consecutiveWrong += 1;
      next.consecutiveCorrect = 0;
      next.inLessonOffsetStage = 0; // restart the in-lesson ladder
    }
  } else if (next.stage === "graduated") {
    if (wasCorrect) {
      next.consecutiveCorrect += 1;
      next.consecutiveWrong = 0;
      const nextIndex = next.longIntervalIndex + 1;
      if (nextIndex >= LONG_INTERVAL_STAGES_MS.length) {
        next.stage = "mastered";
        next.longIntervalIndex = -1;
        next.dueAt = null;
      } else {
        next.longIntervalIndex = nextIndex;
        next.dueAt = new Date(now.getTime() + LONG_INTERVAL_STAGES_MS[nextIndex]).toISOString();
      }
    } else {
      next.consecutiveWrong += 1;
      next.consecutiveCorrect = 0;
      // Interval was too long for this item — pull back two stages.
      next.longIntervalIndex = Math.max(0, next.longIntervalIndex - 2);
      next.dueAt = new Date(now.getTime() + LONG_INTERVAL_STAGES_MS[next.longIntervalIndex]).toISOString();
    }
  } else if (next.stage === "mastered" && !wasCorrect) {
    next.stage = "graduated";
    next.consecutiveWrong += 1;
    next.consecutiveCorrect = 0;
    next.longIntervalIndex = Math.max(0, LONG_INTERVAL_STAGES_MS.length - 3);
    next.dueAt = new Date(now.getTime() + LONG_INTERVAL_STAGES_MS[next.longIntervalIndex]).toISOString();
  }

  return next;
}

export interface SchedulerInput {
  /** Full known vocab catalog — previously tracked items plus any newly extracted ones. */
  items: VocabItem[];
  masteryMap: MasteryMap;
  now: Date;
  config: SchedulerConfig;
}

export interface LessonPlan {
  steps: LessonStep[];
  updatedMasteryMap: MasteryMap;
}

interface PendingRetest {
  itemId: ItemId;
  retestAtStepIndex: number;
}

/**
 * Builds one lesson's ordered step sequence, interleaving graduated
 * cross-session reviews that are due with the introduction of brand-new
 * items, and scheduling each new item's first in-lesson retest a few
 * steps after it's introduced. This is the part of the app that
 * implements Pimsleur's graduated interval recall.
 */
export function buildLessonPlan(input: SchedulerInput): LessonPlan {
  const { items, masteryMap, now, config } = input;
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const mastery: MasteryMap = { ...masteryMap };

  const newQueue: ItemId[] = items
    .filter((item) => !mastery[item.id] || mastery[item.id].stage === "new")
    .slice(0, config.maxNewItemsPerLesson)
    .map((item) => item.id);

  const dueQueue: ItemId[] = selectDueReviewItems(mastery, now, Number.POSITIVE_INFINITY);

  const pendingRetests: PendingRetest[] = [];
  const steps: LessonStep[] = [];
  let stepIndex = 0;

  const pushStep = (type: LessonStep["type"], itemId: ItemId) => {
    const item = itemsById.get(itemId);
    if (!item) return; // defensive: item dropped from catalog since being scheduled
    steps.push({
      stepIndex,
      type,
      itemId,
      targetPhrase: item.targetPhrase,
      sourcePhrase: item.sourcePhrase,
      kanaReading: item.kanaReading,
      alternateReadings: item.alternateReadings,
      jlptLevel: item.jlptLevel,
      kind: item.kind,
      grammarExplanation: item.grammarExplanation,
    });
  };

  while (
    stepIndex < config.maxStepsPerLesson &&
    (newQueue.length > 0 || dueQueue.length > 0 || pendingRetests.length > 0)
  ) {
    const readyIndex = pendingRetests.findIndex((r) => r.retestAtStepIndex <= stepIndex);
    if (readyIndex !== -1) {
      const [ready] = pendingRetests.splice(readyIndex, 1);
      pushStep("anticipate", ready.itemId);
      stepIndex += 1;
      continue;
    }

    const preferReview = dueQueue.length > 0 && (stepIndex % config.reviewToNewRatio !== 0 || newQueue.length === 0);
    if (preferReview) {
      const itemId = dueQueue.shift()!;
      pushStep("anticipate", itemId);
      stepIndex += 1;
      continue;
      // Cross-session items don't re-enter pendingRetests within this
      // lesson; their next interval is set via dueAt by applyStepResult.
    }

    if (newQueue.length > 0) {
      const itemId = newQueue.shift()!;
      pushStep("introduce", itemId);
      mastery[itemId] = {
        ...initMasteryState(itemId),
        stage: "in_lesson",
        inLessonOffsetStage: 0,
      };
      stepIndex += 1;
      pendingRetests.push({ itemId, retestAtStepIndex: stepIndex + IN_LESSON_RETEST_OFFSETS[0] });
      continue;
    }

    if (pendingRetests.length > 0) {
      // Nothing schedulable right now, but a retest is coming later — fast-forward.
      const earliest = Math.min(...pendingRetests.map((r) => r.retestAtStepIndex));
      stepIndex = Math.min(config.maxStepsPerLesson, earliest);
      continue;
    }

    break;
  }

  return { steps, updatedMasteryMap: mastery };
}
