import { Router } from "express";
import { z } from "zod";
import { generateN5VocabContent } from "../services/n5VocabContent.js";

export const n5VocabRouter = Router();

const N5VocabSeedSchema = z.object({
  japanese: z.string().min(1),
  reading: z.string(),
  englishGloss: z.string(),
});

const N5VocabContentRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  seeds: z.array(N5VocabSeedSchema).min(1),
});

n5VocabRouter.post("/content", async (req, res, next) => {
  try {
    const body = N5VocabContentRequestSchema.parse(req.body);
    const items = await generateN5VocabContent(body);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});
