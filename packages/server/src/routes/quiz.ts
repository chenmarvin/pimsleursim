import { Router } from "express";
import { z } from "zod";
import { generateQuiz } from "../services/quiz.js";

export const quizRouter = Router();

const ReviewFocusSchema = z.object({
  vocabulary: z.array(z.string()),
  grammarPatterns: z.array(z.string()),
});

const QuizDrillRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  difficultyHint: z.string().optional(),
  reviewFocus: ReviewFocusSchema.optional(),
});

quizRouter.post("/next", async (req, res, next) => {
  try {
    const body = QuizDrillRequestSchema.parse(req.body);
    const quiz = await generateQuiz(body);
    res.json({ quiz });
  } catch (err) {
    next(err);
  }
});
