import { Router } from "express";
import { z } from "zod";
import { extractVocabulary } from "../services/extraction.js";

export const extractRouter = Router();

const ExtractRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  rawText: z.string().min(1),
  maxItems: z.number().int().positive().max(60).default(20),
});

extractRouter.post("/", async (req, res, next) => {
  try {
    const body = ExtractRequestSchema.parse(req.body);
    const result = await extractVocabulary(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
