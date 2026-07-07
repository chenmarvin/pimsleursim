import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { GrammarPoint } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const SENTENCES_PER_POINT = 4;

const BaseSentenceSchema = z.object({
  label: z.string().describe("Short label for this variation, in the learner's native language, e.g. 'Affirmative, present'"),
  targetText: z.string().describe("One example sentence in the target language demonstrating the pattern"),
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

const JapaneseSentenceSchema = BaseSentenceSchema.extend({
  furigana: z.array(FuriganaSegmentSchema).describe(FURIGANA_INSTRUCTION),
});

const SentenceSchema = BaseSentenceSchema.extend({
  furigana: z.array(FuriganaSegmentSchema).optional(),
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

// Structured outputs doesn't support array length constraints (see the same
// note in extraction.ts), so "exactly 4" is enforced by prompt instruction
// plus the defensive check below, not z.array(...).length(4).
function makeGrammarSchema(isJapanese: boolean) {
  return z.object({
    patternName: z.string().describe("Short name of the grammar pattern being taught, e.g. '〜てはいけない (must not)'"),
    explanation: z.string().describe("One or two sentences explaining the pattern, in the learner's native language"),
    structure: z.string().describe(
      "A concise notation of the grammar structure itself, e.g. 'A は B です' or 'Verb (て-form) + はいけない' — " +
      "distinct from explanation, which describes what it means rather than how it's built."
    ),
    sentences: z.array(isJapanese ? JapaneseSentenceSchema : SentenceSchema),
    commonMistake: z.string().optional().describe(
      "A common mistake learners (especially from the learner's native-language background) make with this pattern, " +
      "in the learner's native language. Omit entirely if there isn't a notable one."
    ),
    chineseDifference: z.string().optional().describe(
      "Only for learners whose native language uses Chinese characters: if this grammar pattern is a 'false friend' — " +
      "resembles a Chinese grammatical construction or word but works meaningfully differently — explain the difference " +
      "here, in the learner's native language. Omit entirely if there's no meaningful difference worth flagging."
    ),
  });
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
  coveredPatterns: string[];
  isJapanese: boolean;
}): string {
  const difficultyLine = opts.difficultyHint
    ? `Target difficulty: ${opts.difficultyHint}. Pick a grammar pattern a learner at this level would be studying next.`
    : "Pick a foundational, high-frequency grammar pattern suitable for a beginner.";

  const coveredLine =
    opts.coveredPatterns.length > 0
      ? `Do NOT reuse any of these already-covered patterns: ${opts.coveredPatterns.join(", ")}.`
      : "";

  const furiganaInstruction = opts.isJapanese
    ? "\n- For EVERY sentence you MUST also provide furigana: targetText split into segments so the app can show hiragana above each kanji run. See the furigana field description for the exact format."
    : "";

  return `You are a language-teaching content designer following the Pimsleur method.

Teach ONE grammar pattern in ${opts.targetLanguageName} to a learner whose native language is ${opts.sourceLanguageName}.

${difficultyLine}
${coveredLine}

Requirements:
- Write a short (1-2 sentence) explanation of the pattern's MEANING, in the learner's native language (${opts.sourceLanguageName}).
- Write a concise STRUCTURE notation showing how the pattern is built (e.g. 'A は B です' or 'Verb (ない-form) + でください') — distinct from the meaning explanation.
- Provide exactly ${SENTENCES_PER_POINT} example sentences drilling the pattern, each with a short label and a natural idiomatic translation.
- If the pattern is a conjugable adjective, copula, or verb form, make the 4 sentences the same base sentence transformed across affirmative/negative x present/past (in that order: affirmative-present, negative-present, affirmative-past, negative-past) — e.g. "Today is hot" -> "Today is not hot" -> "Yesterday was hot" -> "Yesterday was not hot".
- Otherwise (e.g. particles, comparisons, conditionals, and other patterns that don't naturally conjugate that way), provide 4 varied natural example sentences that each clearly demonstrate the pattern in a different realistic context.
- Keep sentences short and conversational, at the target difficulty level.
- Only when genuinely useful, give a commonMistake — a mistake learners from the learner's native-language background commonly make with this pattern, in the learner's native language. Leave it out entirely when there isn't a notable one; don't force one.
- If the learner's native language uses Chinese characters (e.g. Traditional Chinese) and this pattern is a "false friend" relative to Chinese grammar/usage, explain the difference in chineseDifference, in the learner's native language. Omit chineseDifference entirely when there's no meaningful difference worth flagging (most patterns have none).${furiganaInstruction}`;
}

export async function generateGrammarDrill(opts: {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
  coveredPatterns: string[];
}): Promise<GrammarPoint> {
  const isJapanese = opts.targetLanguage.startsWith("ja");

  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(makeGrammarSchema(isJapanese)) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
          targetLanguageName: languageDisplayName(opts.targetLanguage),
          difficultyHint: opts.difficultyHint,
          coveredPatterns: opts.coveredPatterns,
          isJapanese,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Grammar drill generation returned unparseable output");
  }

  const { patternName, explanation, structure, sentences, commonMistake, chineseDifference } = response.parsed_output;
  if (sentences.length < SENTENCES_PER_POINT) {
    throw new Error(`Grammar drill generation returned only ${sentences.length} sentences, expected ${SENTENCES_PER_POINT}`);
  }

  return {
    patternName,
    explanation,
    structure,
    commonMistake,
    chineseDifference,
    sentences: sentences.slice(0, SENTENCES_PER_POINT).map((sentence) => ({
      ...sentence,
      furigana: validFurigana(sentence.furigana, sentence.targetText),
    })),
  };
}
