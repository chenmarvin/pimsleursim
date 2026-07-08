import { Router } from "express";
import { z } from "zod";
import { generateGrammarDrill, generateN5GrammarContent } from "../services/grammar.js";

export const grammarRouter = Router();

const GrammarDrillRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  difficultyHint: z.string().optional(),
  coveredPatterns: z.array(z.string()),
});

grammarRouter.post("/next", async (req, res, next) => {
  try {
    const body = GrammarDrillRequestSchema.parse(req.body);
    const point = await generateGrammarDrill(body);
    res.json({ point });
  } catch (err) {
    next(err);
  }
});

const N5GrammarSeedSchema = z.object({
  pattern: z.string().min(1),
  englishGloss: z.string(),
});

const N5GrammarContentRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  seeds: z.array(N5GrammarSeedSchema).min(1),
});

grammarRouter.post("/n5-content", async (req, res, next) => {
  try {
    const body = N5GrammarContentRequestSchema.parse(req.body);
    const points = await generateN5GrammarContent(body);
    res.json({ points });
  } catch (err) {
    next(err);
  }
});
