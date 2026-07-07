import { Router } from "express";
import { z } from "zod";
import { generateWritingSentences } from "../services/writing.js";

export const writingRouter = Router();

const WritingDrillRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  difficultyHint: z.string().optional(),
});

writingRouter.post("/next", async (req, res, next) => {
  try {
    const body = WritingDrillRequestSchema.parse(req.body);
    const sentences = await generateWritingSentences(body);
    res.json({ sentences });
  } catch (err) {
    next(err);
  }
});
