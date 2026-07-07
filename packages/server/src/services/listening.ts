import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ListeningScript } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const MIN_LINES = 4;
const MAX_LINES = 6;
const MIN_QUESTIONS = 2;
const MAX_QUESTIONS = 3;

const BaseLineSchema = z.object({
  speaker: z.string().describe("Short speaker label, e.g. 'A' or 'B' — not a specific character name"),
  targetText: z.string().describe("One line of dialogue in the target language"),
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

const QuestionSchema = z.object({
  question: z.string().describe("A comprehension question about the script, in the learner's native language"),
  answer: z.string().describe("The answer to the question, in the learner's native language"),
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

function makeListeningSchema(isJapanese: boolean) {
  return z.object({
    lines: z.array(isJapanese ? JapaneseLineSchema : LineSchema),
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

Write a short, natural spoken conversation (a listening-comprehension script) in ${opts.targetLanguageName} between two speakers labeled "A" and "B", for a learner whose native language is ${opts.sourceLanguageName}.

${difficultyLine}

Requirements:
- ${MIN_LINES}-${MAX_LINES} lines total, alternating speakers, on a coherent everyday topic (e.g. introductions, ordering food, asking directions, small talk).
- Keep sentences short and conversational, at the target difficulty level.
- Provide a natural, idiomatic translation for every line, not a literal word-for-word gloss.${furiganaInstruction}
- After the script, write ${MIN_QUESTIONS}-${MAX_QUESTIONS} short comprehension questions (with answers) about what was said, in the learner's native language — testing whether the learner understood the content, not vocabulary trivia.`;
}

export async function generateListeningScript(opts: {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
}): Promise<ListeningScript> {
  const isJapanese = opts.targetLanguage.startsWith("ja");

  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(makeListeningSchema(isJapanese)) },
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
    throw new Error("Listening script generation returned unparseable output");
  }

  const { lines, questions } = response.parsed_output;
  if (lines.length < MIN_LINES) {
    throw new Error(`Listening script generation returned only ${lines.length} lines, expected at least ${MIN_LINES}`);
  }
  if (questions.length < MIN_QUESTIONS) {
    throw new Error(`Listening script generation returned only ${questions.length} questions, expected at least ${MIN_QUESTIONS}`);
  }

  return {
    lines: lines.map((line) => ({
      ...line,
      furigana: validFurigana(line.furigana, line.targetText),
    })),
    questions: questions.slice(0, MAX_QUESTIONS),
  };
}
