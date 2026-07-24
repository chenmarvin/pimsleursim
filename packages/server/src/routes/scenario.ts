import { Router } from "express";
import { z } from "zod";
import { generateScenarioSet } from "../services/scenario.js";

export const scenarioRouter = Router();

const VocabItemSchema = z.object({
  id: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  targetPhrase: z.string(),
  sourcePhrase: z.string(),
  notes: z.string().optional(),
  kanaReading: z.string().optional(),
  alternateReadings: z.array(z.string()).optional(),
});

const ScenarioDrillRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  difficultyHint: z.string().optional(),
  vocab: z.array(VocabItemSchema).optional(),
});

scenarioRouter.post("/next", async (req, res, next) => {
  try {
    const body = ScenarioDrillRequestSchema.parse(req.body);
    const set = await generateScenarioSet(body);
    res.json({ set });
  } catch (err) {
    next(err);
  }
});
