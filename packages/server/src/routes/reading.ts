import { Router } from "express";
import { z } from "zod";
import { generateReadingPassage } from "../services/reading.js";

export const readingRouter = Router();

const ReadingDrillRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  difficultyHint: z.string().optional(),
});

readingRouter.post("/next", async (req, res, next) => {
  try {
    const body = ReadingDrillRequestSchema.parse(req.body);
    const passage = await generateReadingPassage(body);
    res.json({ passage });
  } catch (err) {
    next(err);
  }
});
