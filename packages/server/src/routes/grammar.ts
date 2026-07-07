import { Router } from "express";
import { z } from "zod";
import { generateGrammarDrill } from "../services/grammar.js";

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
