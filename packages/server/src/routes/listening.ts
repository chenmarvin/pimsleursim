import { Router } from "express";
import { z } from "zod";
import { generateListeningScript } from "../services/listening.js";

export const listeningRouter = Router();

const ListeningDrillRequestSchema = z.object({
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  difficultyHint: z.string().optional(),
});

listeningRouter.post("/next", async (req, res, next) => {
  try {
    const body = ListeningDrillRequestSchema.parse(req.body);
    const script = await generateListeningScript(body);
    res.json({ script });
  } catch (err) {
    next(err);
  }
});
