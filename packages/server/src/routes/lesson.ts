import { Router } from "express";
import { z } from "zod";
import { buildLessonPlan, DEFAULT_SCHEDULER_CONFIG } from "@pimsleursim/shared";

export const lessonRouter = Router();

const VocabItemSchema = z.object({
  id: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  targetPhrase: z.string(),
  sourcePhrase: z.string(),
  notes: z.string().optional(),
  kanaReading: z.string().optional(),
});

const MasteryStateSchema = z.object({
  itemId: z.string(),
  stage: z.enum(["new", "in_lesson", "graduated", "mastered"]),
  inLessonOffsetStage: z.number(),
  longIntervalIndex: z.number(),
  dueAt: z.string().nullable(),
  consecutiveCorrect: z.number(),
  consecutiveWrong: z.number(),
  totalReviews: z.number(),
  lastResult: z.enum(["correct", "incorrect"]).nullable(),
  lastSeenAt: z.string().nullable(),
});

const LessonPlanRequestSchema = z.object({
  items: z.array(VocabItemSchema),
  masteryMap: z.record(z.string(), MasteryStateSchema),
  config: z
    .object({
      maxNewItemsPerLesson: z.number().int().positive().optional(),
      maxStepsPerLesson: z.number().int().positive().optional(),
      reviewToNewRatio: z.number().int().positive().optional(),
    })
    .optional(),
});

lessonRouter.post("/next", (req, res, next) => {
  try {
    const body = LessonPlanRequestSchema.parse(req.body);
    const plan = buildLessonPlan({
      items: body.items,
      masteryMap: body.masteryMap,
      now: new Date(),
      config: { ...DEFAULT_SCHEDULER_CONFIG, ...body.config },
    });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});
