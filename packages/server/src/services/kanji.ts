import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { KanjiEntry } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const MIN_WORDS = 2;
const MAX_WORDS = 4;

const KanjiWordSchema = z.object({
  word: z.string().describe("A common word using this kanji character"),
  reading: z.string().describe("Complete hiragana reading of the word"),
  meaning: z.string().describe("Meaning of the word, in the learner's native language"),
});

const FuriganaSegmentSchema = z.object({
  text: z.string().describe("Exact substring of the annotated text this segment covers"),
  reading: z.string().optional().describe(
    "Hiragana reading of this segment. Include ONLY if text contains kanji; omit for kana/punctuation/romaji segments."
  ),
});

const FURIGANA_INSTRUCTION =
  'REQUIRED: split exampleSentence into segments for furigana display. Concatenating every segment\'s text, in order, ' +
  "MUST reconstruct exampleSentence EXACTLY (same characters, same order, no gaps or overlaps). Give each contiguous run " +
  "of kanji its own segment with its hiragana reading; keep kana/punctuation/other characters as separate segment(s) " +
  'with no reading. Example: \'今日は天気がいいですね\' → ' +
  '[{"text":"今日","reading":"きょう"},{"text":"は"},{"text":"天気","reading":"てんき"},{"text":"が"},{"text":"いいですね"}].';

const KanjiEntrySchema = z.object({
  character: z.string().describe("The single kanji character being taught"),
  meaning: z.string().describe("Core meaning(s) of the character, in the learner's native language"),
  onReadings: z.array(z.string()).describe("On-yomi (Chinese-derived) readings, in katakana. Empty array if none."),
  kunReadings: z.array(z.string()).describe("Kun-yomi (native Japanese) readings, in hiragana. Empty array if none."),
  words: z.array(KanjiWordSchema).describe(`${MIN_WORDS}-${MAX_WORDS} common words that use this character`),
  exampleSentence: z.string().describe("A short example sentence using this character in one of the words above"),
  exampleSentenceTranslation: z.string().describe("Natural, idiomatic translation of exampleSentence into the learner's native language"),
  furigana: z.array(FuriganaSegmentSchema).describe(FURIGANA_INSTRUCTION),
  strokeOrderTip: z.string().describe(
    "A short, concrete tip for remembering the stroke order or writing the character correctly, in the learner's native language"
  ),
  chineseDifference: z.string().optional().describe(
    "Only for learners whose native language uses Chinese characters: if this kanji is a 'false friend' — looks the same/" +
    "similar to a Chinese hanzi but differs meaningfully in meaning, usage, or form — explain the difference here, in the " +
    "learner's native language. Omit entirely if there's no meaningful difference worth flagging."
  ),
});

// Defensive check on LLM output: only trust furigana segments if they
// reconstruct the annotated text exactly, so a slip never garbles the
// rendered sentence — the client falls back to plain text when absent.
function validFurigana(
  segments: { text: string; reading?: string }[] | undefined,
  text: string,
): { text: string; reading?: string }[] | undefined {
  if (!segments || segments.map((s) => s.text).join("") !== text) return undefined;
  return segments;
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
  difficultyHint?: string;
  coveredKanji: string[];
}): string {
  const difficultyLine = opts.difficultyHint
    ? `Target difficulty: ${opts.difficultyHint}. Pick a kanji character a learner at this level would be studying next.`
    : "Pick a foundational, high-frequency kanji suitable for a beginner.";

  const coveredLine =
    opts.coveredKanji.length > 0
      ? `Do NOT reuse any of these already-covered characters: ${opts.coveredKanji.join(", ")}.`
      : "";

  return `You are a language-teaching content designer following the Pimsleur method, teaching Japanese kanji to a learner whose native language is ${opts.sourceLanguageName}.

Teach ONE kanji character. Go beyond rote memorization of the character shape:

${difficultyLine}
${coveredLine}

Requirements:
- Give the character's core meaning(s), in ${opts.sourceLanguageName}.
- List its on-yomi readings (katakana) and kun-yomi readings (hiragana). Use an empty array for whichever list genuinely doesn't apply.
- Give ${MIN_WORDS}-${MAX_WORDS} common words that use this character, each with its complete hiragana reading and meaning in ${opts.sourceLanguageName}.
- Write one short, natural example sentence that uses the character (via one of the words above), with an idiomatic translation.
- Provide furigana for the example sentence: split into segments so the app can show hiragana above each kanji run. See the furigana field description for the exact format.
- Give one short, concrete tip for remembering the stroke order or how to write the character, in ${opts.sourceLanguageName}.
- If the learner's native language uses Chinese characters (e.g. Traditional Chinese) and this kanji is a "false friend" relative to the corresponding Chinese hanzi — same or similar appearance but a meaningfully different meaning or usage — explain the difference in chineseDifference, in ${opts.sourceLanguageName}. Omit chineseDifference entirely when there's no meaningful difference worth flagging.`;
}

export async function generateKanjiEntry(opts: {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
  coveredKanji: string[];
}): Promise<KanjiEntry> {
  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(KanjiEntrySchema) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
          difficultyHint: opts.difficultyHint,
          coveredKanji: opts.coveredKanji,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Kanji entry generation returned unparseable output");
  }

  const { furigana, exampleSentence, words, ...rest } = response.parsed_output;
  if (words.length < MIN_WORDS) {
    throw new Error(`Kanji entry generation returned only ${words.length} words, expected at least ${MIN_WORDS}`);
  }

  return {
    ...rest,
    exampleSentence,
    words: words.slice(0, MAX_WORDS),
    exampleSentenceFurigana: validFurigana(furigana, exampleSentence),
  };
}
