import { Router } from "express";
import { z } from "zod";
import { generateShadowingSet } from "../services/shadowing.js";

export const shadowingRouter = Router();

const ShadowingDrillRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  difficultyHint: z.string().optional(),
});

shadowingRouter.post("/next", async (req, res, next) => {
  try {
    const body = ShadowingDrillRequestSchema.parse(req.body);
    const set = await generateShadowingSet(body);
    res.json({ set });
  } catch (err) {
    next(err);
  }
});
