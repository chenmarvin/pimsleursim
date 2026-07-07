import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ShadowingSet } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const LINE_COUNT = 3;

const BaseLineSchema = z.object({
  targetText: z.string().describe("One short, natural sentence in the target language, suitable for shadowing practice"),
  sourceText: z.string().describe("Natural, idiomatic translation of targetText into the learner's native language"),
});

const FuriganaSegmentSchema = z.object({
  text: z.string().describe("Exact substring of the annotated text this segment covers"),
  reading: z.string().optional().describe(
    "Hiragana reading of this segment. Include ONLY if text contains kanji; omit for kana/punctuation/romaji segments."
  ),
});

const FURIGANA_INSTRUCTION =
  'REQUIRED: split targetText into segments for furigana display. Concatenating every segment\'s text, in order, ' +
  "MUST reconstruct targetText EXACTLY (same characters, same order, no gaps or overlaps). Give each contiguous run " +
  "of kanji its own segment with its hiragana reading; keep kana/punctuation/other characters as separate segment(s) " +
  'with no reading. Example: \'今日は天気がいいですね\' → ' +
  '[{"text":"今日","reading":"きょう"},{"text":"は"},{"text":"天気","reading":"てんき"},{"text":"が"},{"text":"いいですね"}].';

const JapaneseLineSchema = BaseLineSchema.extend({
  furigana: z.array(FuriganaSegmentSchema).describe(FURIGANA_INSTRUCTION),
});

const LineSchema = BaseLineSchema.extend({
  furigana: z.array(FuriganaSegmentSchema).optional(),
});

function validFurigana(
  segments: { text: string; reading?: string }[] | undefined,
  text: string,
): { text: string; reading?: string }[] | undefined {
  if (!segments || segments.map((s) => s.text).join("") !== text) return undefined;
  return segments;
}

function makeShadowingSchema(isJapanese: boolean) {
  return z.object({ lines: z.array(isJapanese ? JapaneseLineSchema : LineSchema) });
}

function languageDisplayName(bcp47: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(bcp47) ?? bcp47;
  } catch {
    return bcp47;
  }
}

function buildPrompt(opts: {
  sourceLanguageName: string;
  targetLanguageName: string;
  difficultyHint?: string;
  isJapanese: boolean;
}): string {
  const difficultyLine = opts.difficultyHint
    ? `Target difficulty: ${opts.difficultyHint}.`
    : "Target a beginner learner.";

  const furiganaInstruction = opts.isJapanese
    ? "\n- For EVERY line you MUST also provide furigana: targetText split into segments so the app can show hiragana above each kanji run. See the furigana field description for the exact format."
    : "";

  return `You are a language-teaching content designer following the Pimsleur method.

Write exactly ${LINE_COUNT} short, natural sentences in ${opts.targetLanguageName} for a learner whose native language is ${opts.sourceLanguageName} to practice speaking/shadowing (repeating aloud after audio).

${difficultyLine}

Requirements:
- The ${LINE_COUNT} sentences should form a small coherent set (e.g. a short self-introduction, or a few related everyday phrases) — not unrelated one-offs.
- Keep each sentence short enough to comfortably repeat aloud from memory.
- Provide a natural, idiomatic translation for every line.${furiganaInstruction}`;
}

export async function generateShadowingSet(opts: {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
}): Promise<ShadowingSet> {
  const isJapanese = opts.targetLanguage.startsWith("ja");

  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 1024,
    output_config: { format: zodOutputFormat(makeShadowingSchema(isJapanese)) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
          targetLanguageName: languageDisplayName(opts.targetLanguage),
          difficultyHint: opts.difficultyHint,
          isJapanese,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Shadowing set generation returned unparseable output");
  }

  const { lines } = response.parsed_output;
  if (lines.length < LINE_COUNT) {
    throw new Error(`Shadowing set generation returned only ${lines.length} lines, expected ${LINE_COUNT}`);
  }

  return {
    lines: lines.slice(0, LINE_COUNT).map((line) => ({
      ...line,
      furigana: validFurigana(line.furigana, line.targetText),
    })),
  };
}
