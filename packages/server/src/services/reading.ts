import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ReadingPassage, ReviewFocus } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const MIN_QUESTIONS = 2;
const MAX_QUESTIONS = 3;

const FuriganaSegmentSchema = z.object({
  text: z.string().describe("Exact substring of the annotated text this segment covers"),
  reading: z.string().optional().describe(
    "Hiragana reading of this segment. Include ONLY if text contains kanji; omit for kana/punctuation/romaji segments."
  ),
});

const FURIGANA_INSTRUCTION =
  'REQUIRED: split passage into segments for furigana display. Concatenating every segment\'s text, in order, ' +
  "MUST reconstruct passage EXACTLY (same characters, same order, no gaps or overlaps). Give each contiguous run " +
  "of kanji its own segment with its hiragana reading; keep kana/punctuation/other characters as separate segment(s) " +
  'with no reading. Example: \'今日は天気がいいですね\' → ' +
  '[{"text":"今日","reading":"きょう"},{"text":"は"},{"text":"天気","reading":"てんき"},{"text":"が"},{"text":"いいですね"}].';

const QuestionSchema = z.object({
  question: z.string().describe("A comprehension question about the passage, in the learner's native language"),
  answer: z.string().describe("The answer to the question, in the learner's native language"),
});

function validFurigana(
  segments: { text: string; reading?: string }[] | undefined,
  text: string,
): { text: string; reading?: string }[] | undefined {
  if (!segments || segments.map((s) => s.text).join("") !== text) return undefined;
  return segments;
}

function makeReadingSchema(isJapanese: boolean) {
  return z.object({
    passage: z.string().describe("A short reading passage in the target language"),
    passageTranslation: z.string().describe("Natural, idiomatic translation of passage into the learner's native language"),
    furigana: isJapanese
      ? z.array(FuriganaSegmentSchema).describe(FURIGANA_INSTRUCTION)
      : z.array(FuriganaSegmentSchema).optional(),
    questions: z.array(QuestionSchema),
  });
}

function languageDisplayName(bcp47: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(bcp47) ?? bcp47;
  } catch {
    return bcp47;
  }
}

// N3+ reading material shifts toward authentic sources per the course spec;
// N5/N4 stay with very short, simple, made-up passages suited to a beginner.
function materialTypeHint(difficultyHint?: string): string {
  if (!difficultyHint) return "";
  if (difficultyHint.includes("N3")) return " Model it on the style of NHK News Easy, a blog post, or an email.";
  if (difficultyHint.includes("N2")) return " Model it on the style of a newspaper article, business correspondence, or a technical article.";
  if (difficultyHint.includes("N1")) return " Model it on the style of an editorial, white paper, legal document, technical manual, or academic paper.";
  return "";
}

// N5 review lessons pass previously-taught words/patterns here so the passage
// reinforces actual prior material instead of inventing unrelated content (REQ-11).
function reviewFocusLine(reviewFocus?: ReviewFocus): string {
  if (!reviewFocus || (reviewFocus.vocabulary.length === 0 && reviewFocus.grammarPatterns.length === 0)) return "";
  const parts: string[] = [];
  if (reviewFocus.vocabulary.length > 0) parts.push(`vocabulary: ${reviewFocus.vocabulary.join(", ")}`);
  if (reviewFocus.grammarPatterns.length > 0) parts.push(`grammar patterns: ${reviewFocus.grammarPatterns.join(", ")}`);
  return `\nThis is a REVIEW passage: naturally weave in as many of these previously-taught items as you reasonably can, rather than introducing new vocabulary/grammar — ${parts.join("; ")}.`;
}

function buildPrompt(opts: {
  sourceLanguageName: string;
  targetLanguageName: string;
  difficultyHint?: string;
  isJapanese: boolean;
  reviewFocus?: ReviewFocus;
}): string {
  const difficultyLine = opts.difficultyHint
    ? `Target difficulty: ${opts.difficultyHint}.${materialTypeHint(opts.difficultyHint)}`
    : "Target a beginner learner: keep the passage very short and simple.";

  const furiganaInstruction = opts.isJapanese
    ? "\n- You MUST also provide furigana: passage split into segments so the app can show hiragana above each kanji run. See the furigana field description for the exact format."
    : "";

  return `You are a language-teaching content designer following the Pimsleur method.

Write a short reading passage in ${opts.targetLanguageName} for a learner whose native language is ${opts.sourceLanguageName}.

${difficultyLine}${reviewFocusLine(opts.reviewFocus)}

Requirements:
- At beginner levels keep the passage to just a few short sentences; at higher levels it may be a short paragraph, but always keep it appropriately concise for spoken-repetition-style study, not a full article.
- Write on a coherent, realistic everyday topic.
- Provide a natural, idiomatic translation of the whole passage into the learner's native language.${furiganaInstruction}
- After the passage, write ${MIN_QUESTIONS}-${MAX_QUESTIONS} short comprehension questions (with answers) about its content, in the learner's native language — testing whether the learner understood what was read, not vocabulary trivia.`;
}

export async function generateReadingPassage(opts: {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
  reviewFocus?: ReviewFocus;
}): Promise<ReadingPassage> {
  const isJapanese = opts.targetLanguage.startsWith("ja");

  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(makeReadingSchema(isJapanese)) },
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
    throw new Error("Reading passage generation returned unparseable output");
  }

  const { passage, passageTranslation, furigana, questions } = response.parsed_output;
  if (questions.length < MIN_QUESTIONS) {
    throw new Error(`Reading passage generation returned only ${questions.length} questions, expected at least ${MIN_QUESTIONS}`);
  }

  return {
    passage,
    passageTranslation,
    furigana: validFurigana(furigana, passage),
    questions: questions.slice(0, MAX_QUESTIONS),
  };
}
