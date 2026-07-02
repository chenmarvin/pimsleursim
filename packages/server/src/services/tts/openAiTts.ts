import { config } from "../../config.js";
import type { TTSProvider, TTSSynthesizeOptions, TTSSynthesizeResult } from "./TTSProvider.js";

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const DEFAULT_VOICE = "alloy";

export class OpenAiTTSProvider implements TTSProvider {
  readonly name = "openai";

  async synthesize(opts: TTSSynthesizeOptions): Promise<TTSSynthesizeResult> {
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not set — required for the openai TTS provider");
    }

    const response = await fetch(OPENAI_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: opts.text,
        voice: opts.voice ?? DEFAULT_VOICE,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI TTS request failed (${response.status}): ${errorText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return { audioBuffer, mimeType: "audio/mpeg" };
  }
}
