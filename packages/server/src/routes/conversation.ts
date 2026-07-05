import { Router } from "express";
import { z } from "zod";
import { generateConversation } from "../services/conversation.js";

export const conversationRouter = Router();

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

const ConversationRequestSchema = z.object({
  items: z.array(VocabItemSchema).min(1),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
});

conversationRouter.post("/", async (req, res, next) => {
  try {
    const body = ConversationRequestSchema.parse(req.body);
    const lines = await generateConversation(body);
    res.json({ lines });
  } catch (err) {
    next(err);
  }
});
