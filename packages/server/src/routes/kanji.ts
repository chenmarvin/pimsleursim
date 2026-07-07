import { Router } from "express";
import { z } from "zod";
import { generateKanjiEntry } from "../services/kanji.js";

export const kanjiRouter = Router();

const KanjiDrillRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  difficultyHint: z.string().optional(),
  coveredKanji: z.array(z.string()),
});

kanjiRouter.post("/next", async (req, res, next) => {
  try {
    const body = KanjiDrillRequestSchema.parse(req.body);
    const entry = await generateKanjiEntry(body);
    res.json({ entry });
  } catch (err) {
    next(err);
  }
});
