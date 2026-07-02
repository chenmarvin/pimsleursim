export interface TTSSynthesizeOptions {
  text: string;
  languageCode: string; // BCP-47, e.g. "ja-JP"
  voice?: string;
}

export interface TTSSynthesizeResult {
  audioBuffer: Buffer;
  mimeType: string;
}

export interface TTSProvider {
  readonly name: string;
  synthesize(opts: TTSSynthesizeOptions): Promise<TTSSynthesizeResult>;
}

let cachedProvider: TTSProvider | null = null;

export async function getTTSProvider(): Promise<TTSProvider> {
  if (cachedProvider) return cachedProvider;
  const providerName = process.env.TTS_PROVIDER ?? "openai";
  switch (providerName) {
    case "openai": {
      const { OpenAiTTSProvider } = await import("./openAiTts.js");
      cachedProvider = new OpenAiTTSProvider();
      return cachedProvider;
    }
    default:
      throw new Error(`Unknown TTS_PROVIDER: ${providerName}`);
  }
}
