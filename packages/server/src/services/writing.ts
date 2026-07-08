import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ReviewFocus, WritingSentence } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const MIN_SENTENCES = 5;
const MAX_SENTENCES = 8;

const BaseSentenceSchema = z.object({
  sourceText: z.string().describe("A short sentence in the learner's native language, to be translated into the target language"),
  targetText: z.string().describe("The expected translation, in the target language"),
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

const JapaneseSentenceSchema = BaseSentenceSchema.extend({
  furigana: z.array(FuriganaSegmentSchema).describe(FURIGANA_INSTRUCTION),
});

const SentenceSchema = BaseSentenceSchema.extend({
  furigana: z.array(FuriganaSegmentSchema).optional(),
});

function validFurigana(
  segments: { text: string; reading?: string }[] | undefined,
  text: string,
): { text: string; reading?: string }[] | undefined {
  if (!segments || segments.map((s) => s.text).join("") !== text) return undefined;
  return segments;
}

function makeWritingSchema(isJapanese: boolean) {
  return z.object({ sentences: z.array(isJapanese ? JapaneseSentenceSchema : SentenceSchema) });
}

function languageDisplayName(bcp47: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(bcp47) ?? bcp47;
  } catch {
    return bcp47;
  }
}

// N5 review lessons pass previously-taught words/patterns here so the sentences
// reinforce actual prior material instead of inventing unrelated content (REQ-11).
function reviewFocusLine(reviewFocus?: ReviewFocus): string {
  if (!reviewFocus || (reviewFocus.vocabulary.length === 0 && reviewFocus.grammarPatterns.length === 0)) return "";
  const parts: string[] = [];
  if (reviewFocus.vocabulary.length > 0) parts.push(`vocabulary: ${reviewFocus.vocabulary.join(", ")}`);
  if (reviewFocus.grammarPatterns.length > 0) parts.push(`grammar patterns: ${reviewFocus.grammarPatterns.join(", ")}`);
  return `\nThis is REVIEW practice: base the sentences on these previously-taught items as much as reasonably possible, rather than introducing new vocabulary/grammar — ${parts.join("; ")}.`;
}

function buildPrompt(opts: {
  sourceLanguageName: string;
  targetLanguageName: string;
  difficultyHint?: string;
  isJapanese: boolean;
  reviewFocus?: ReviewFocus;
}): string {
  const difficultyLine = opts.difficultyHint
    ? `Target difficulty: ${opts.difficultyHint}.`
    : "Target a beginner learner.";

  const furiganaInstruction = opts.isJapanese
    ? "\n- For EVERY sentence you MUST also provide furigana: targetText split into segments so the app can show hiragana above each kanji run. See the furigana field description for the exact format."
    : "";

  return `You are a language-teaching content designer following the Pimsleur method.

Write ${MIN_SENTENCES}-${MAX_SENTENCES} short sentences, in the learner's native language (${opts.sourceLanguageName}), for the learner to translate into ${opts.targetLanguageName} as writing practice.

${difficultyLine}${reviewFocusLine(opts.reviewFocus)}

Requirements:
- Each sourceText should be simple enough to translate in one short ${opts.targetLanguageName} sentence, using vocabulary/grammar appropriate to the target difficulty.
- Vary the sentences (different subjects/verbs/topics) rather than minor variations of the same sentence.
- Provide the expected targetText translation for each.${furiganaInstruction}`;
}

export async function generateWritingSentences(opts: {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
  reviewFocus?: ReviewFocus;
}): Promise<WritingSentence[]> {
  const isJapanese = opts.targetLanguage.startsWith("ja");

  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(makeWritingSchema(isJapanese)) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
          targetLanguageName: languageDisplayName(opts.targetLanguage),
          difficultyHint: opts.difficultyHint,
          isJapanese,
          reviewFocus: opts.reviewFocus,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Writing sentence generation returned unparseable output");
  }

  const { sentences } = response.parsed_output;
  if (sentences.length < MIN_SENTENCES) {
    throw new Error(`Writing sentence generation returned only ${sentences.length} sentences, expected at least ${MIN_SENTENCES}`);
  }

  return sentences.slice(0, MAX_SENTENCES).map((sentence) => ({
    ...sentence,
    furigana: validFurigana(sentence.furigana, sentence.targetText),
  }));
}
