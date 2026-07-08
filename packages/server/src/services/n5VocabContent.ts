import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { N5VocabSeed, VocabItem } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const FuriganaSegmentSchema = z.object({
  text: z.string().describe("Exact substring of the annotated text this segment covers"),
  reading: z.string().optional().describe(
    "Hiragana reading of this segment. Include ONLY if text contains kanji; omit for kana/punctuation/romaji segments."
  ),
});

const FURIGANA_INSTRUCTION = (fieldName: string) =>
  `REQUIRED: split ${fieldName} into segments for furigana display. Concatenating every segment's text, in order, ` +
  "MUST reconstruct it EXACTLY (same characters, same order, no gaps or overlaps). Give each contiguous run of kanji " +
  "its own segment with its hiragana reading; keep kana/punctuation/other characters as separate segment(s) with no " +
  "reading. Example: '今日は天気がいいですね' → " +
  '[{"text":"今日","reading":"きょう"},{"text":"は"},{"text":"天気","reading":"てんき"},{"text":"が"},{"text":"いいですね"}].';

// The word itself, its reading, and its English gloss are fixed facts from the syllabus
// (see n5Syllabus.ts) — this schema only covers the pedagogical content generated per word.
const VocabContentItemSchema = z.object({
  sourcePhrase: z.string().describe("Natural, idiomatic translation of the word into the learner's native language"),
  furigana: z.array(FuriganaSegmentSchema).describe(FURIGANA_INSTRUCTION("the word (targetPhrase)")),
  exampleSentence: z.string().describe("A short, natural example sentence in Japanese that uses the word"),
  exampleTranslation: z.string().describe("Natural, idiomatic translation of exampleSentence into the learner's native language"),
  exampleFurigana: z.array(FuriganaSegmentSchema).describe(FURIGANA_INSTRUCTION("exampleSentence")),
  commonMistake: z.string().optional().describe(
    "A common mistake learners (especially from the learner's native-language background) make with this word, " +
    "in the learner's native language. Omit entirely if there isn't a notable one."
  ),
  memoryTip: z.string().optional().describe(
    "A short mnemonic or memory aid to help remember this word, in the learner's native language. Omit entirely if " +
    "there isn't a good one."
  ),
  chineseDifference: z.string().optional().describe(
    "Only for learners whose native language uses Chinese characters: if this word is a 'false friend' — shares " +
    "characters with a Chinese word but differs meaningfully in meaning or usage — explain the difference here, in " +
    "the learner's native language. Omit entirely if there's no meaningful difference worth flagging."
  ),
});

const N5VocabContentSchema = z.object({ items: z.array(VocabContentItemSchema) });

function languageDisplayName(bcp47: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(bcp47) ?? bcp47;
  } catch {
    return bcp47;
  }
}

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

function buildPrompt(opts: { seeds: N5VocabSeed[]; sourceLanguageName: string }): string {
  const wordList = opts.seeds
    .map((seed, i) => `${i + 1}. ${seed.japanese} (reading: ${seed.reading}) — ${seed.englishGloss}`)
    .join("\n");

  return `You are a language-teaching content designer following the Pimsleur method, teaching Japanese to a learner whose native language is ${opts.sourceLanguageName}.

The ${opts.seeds.length} Japanese words below are FIXED — they come from a curated N5 curriculum. Do NOT change, replace, or reinterpret the word, its reading, or its meaning. For EACH word, in the SAME ORDER, generate the pedagogical content described below:

${wordList}

Requirements, for each word:
- sourcePhrase: a natural, idiomatic translation of the word into ${opts.sourceLanguageName}, consistent with the given English gloss.
- furigana: split the word into segments using its GIVEN reading above — do not invent a different reading.
- One short, natural exampleSentence using the word, with an idiomatic exampleTranslation into ${opts.sourceLanguageName}, and exampleFurigana for that sentence.
- Only when genuinely useful, a commonMistake and/or memoryTip in ${opts.sourceLanguageName}. Leave them out entirely when there isn't a notable one — don't force one for every word.
- If ${opts.sourceLanguageName} uses Chinese characters (e.g. Traditional Chinese) and the word is a "false friend" relative to a Chinese word/phrase that shares characters with it, explain the difference in chineseDifference. Omit entirely when there's no meaningful difference worth flagging (most words have none).`;
}

export async function generateN5VocabContent(opts: {
  sourceLanguage: string;
  targetLanguage: string;
  seeds: N5VocabSeed[];
}): Promise<VocabItem[]> {
  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 8192,
    output_config: { format: zodOutputFormat(N5VocabContentSchema) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          seeds: opts.seeds,
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("N5 vocab content generation returned unparseable output");
  }

  const { items } = response.parsed_output;
  if (items.length < opts.seeds.length) {
    throw new Error(`N5 vocab content generation returned ${items.length} items, expected ${opts.seeds.length}`);
  }

  return opts.seeds.map((seed, i) => {
    const generated = items[i];
    return {
      id: randomUUID(),
      sourceLanguage: opts.sourceLanguage,
      targetLanguage: opts.targetLanguage,
      targetPhrase: seed.japanese,
      sourcePhrase: generated.sourcePhrase,
      kanaReading: seed.reading,
      furigana: validFurigana(generated.furigana, seed.japanese),
      englishTranslation: seed.englishGloss,
      exampleSentence: generated.exampleSentence,
      exampleTranslation: generated.exampleTranslation,
      exampleFurigana: validFurigana(generated.exampleFurigana, generated.exampleSentence),
      commonMistake: generated.commonMistake,
      memoryTip: generated.memoryTip,
      chineseDifference: generated.chineseDifference,
    };
  });
}
