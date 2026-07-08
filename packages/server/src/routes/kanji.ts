import { Router } from "express";
import { z } from "zod";
import { generateKanjiEntry, generateN5KanjiContent } from "../services/kanji.js";

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

const N5KanjiSeedSchema = z.object({
  character: z.string().min(1),
  onReading: z.string(),
  kunReading: z.string(),
  englishGloss: z.string(),
});

const N5KanjiContentRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  seeds: z.array(N5KanjiSeedSchema).min(1),
});

kanjiRouter.post("/n5-content", async (req, res, next) => {
  try {
    const body = N5KanjiContentRequestSchema.parse(req.body);
    const entries = await generateN5KanjiContent(body);
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});
