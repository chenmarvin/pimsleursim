import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

// dotenv's default `.env` lookup is relative to process.cwd(), which npm
// changes to this package's directory when run via
// `npm run <script> --workspace=@pimsleursim/server` (or `npm run dev` at
// the repo root, which does the same). Resolve the root .env explicitly so
// it's found regardless of which directory the process was launched from.
loadEnv({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
  claudeModel: process.env.CLAUDE_MODEL ?? "claude-opus-4-8",
  ttsProvider: process.env.TTS_PROVIDER ?? "openai",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
};
