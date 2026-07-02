import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getTTSProvider } from "../services/tts/TTSProvider.js";

export const ttsRouter = Router();

const TTSRequestSchema = z.object({
  text: z.string().min(1),
  languageCode: z.string().min(1),
  voice: z.string().optional(),
});

interface CacheEntry {
  audioBase64: string | null;
  mimeType: string | null;
}

const NO_AUDIO: CacheEntry = { audioBase64: null, mimeType: null };

// No credentials for the configured TTS provider — degrade to a silent,
// text-only lesson instead of failing every step's audio playback.
function hasTtsCredentials(): boolean {
  if (config.ttsProvider === "openai") return Boolean(config.openaiApiKey);
  return false;
}

// Short phrases replay across many graduated-interval reviews, so a small
// in-memory cache avoids re-synthesizing the same audio repeatedly.
const cache = new Map<string, CacheEntry>();

function cacheKey(text: string, languageCode: string, voice?: string): string {
  return createHash("sha256").update(`${text}::${languageCode}::${voice ?? ""}`).digest("hex");
}

ttsRouter.post("/", async (req, res, next) => {
  try {
    const body = TTSRequestSchema.parse(req.body);

    if (!hasTtsCredentials()) {
      res.json(NO_AUDIO);
      return;
    }

    const key = cacheKey(body.text, body.languageCode, body.voice);

    const cached = cache.get(key);
    if (cached) {
      res.json(cached);
      return;
    }

    const provider = await getTTSProvider();
    const { audioBuffer, mimeType } = await provider.synthesize(body);
    const entry: CacheEntry = { audioBase64: audioBuffer.toString("base64"), mimeType };
    cache.set(key, entry);
    res.json(entry);
  } catch (err) {
    next(err);
  }
});
