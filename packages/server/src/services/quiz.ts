import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { QuizSet, ReviewFocus } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const PILLARS = ["vocabulary", "grammar", "reading", "kanji"] as const;

const QuestionSchema = z.object({
  pillar: z.enum(PILLARS).describe("Which content pillar this question tests"),
  type: z.enum(["multiple_choice", "fill_in_blank", "listening"]).describe(
    "Question format. Vary this across the 4 questions so multiple_choice, fill_in_blank, and listening all appear " +
    "at least once."
  ),
  prompt: z.string().describe(
    "The question or instructions, in the learner's native language. For multiple_choice/fill_in_blank about a target-" +
    "language word or sentence, include that target-language text directly in the prompt (e.g. \"What does 会社員 mean?\" " +
    "or \"Fill in the blank: 私は台湾人＿＿。\")."
  ),
  audioText: z.string().optional().describe(
    "REQUIRED when type is 'listening', and ONLY then: a short sentence in the target language that will be read aloud " +
    "via text-to-speech before the learner sees the question. Omit entirely for other question types."
  ),
  options: z.array(z.string()).optional().describe(
    "REQUIRED when type is 'multiple_choice', and ONLY then: 3-4 answer choices, one of which exactly matches `answer`. " +
    "Omit entirely for other question types."
  ),
  answer: z.string().describe("The correct answer, as plain text (for multiple_choice, must exactly match one of options)"),
});

const QuizSchema = z.object({ questions: z.array(QuestionSchema) });

function languageDisplayName(bcp47: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(bcp47) ?? bcp47;
  } catch {
    return bcp47;
  }
}

// N5 review lessons pass previously-taught words/patterns here so the quiz tests
// actual prior material instead of inventing unrelated content (REQ-11).
function reviewFocusLine(reviewFocus?: ReviewFocus): string {
  if (!reviewFocus || (reviewFocus.vocabulary.length === 0 && reviewFocus.grammarPatterns.length === 0)) return "";
  const parts: string[] = [];
  if (reviewFocus.vocabulary.length > 0) parts.push(`vocabulary: ${reviewFocus.vocabulary.join(", ")}`);
  if (reviewFocus.grammarPatterns.length > 0) parts.push(`grammar patterns: ${reviewFocus.grammarPatterns.join(", ")}`);
  return `\nThis is a REVIEW quiz: base questions on these previously-taught items as much as reasonably possible, rather than introducing new vocabulary/grammar — ${parts.join("; ")}.`;
}

function buildPrompt(opts: {
  sourceLanguageName: string;
  targetLanguageName: string;
  difficultyHint?: string;
  reviewFocus?: ReviewFocus;
}): string {
  const difficultyLine = opts.difficultyHint
    ? `Target difficulty: ${opts.difficultyHint}.`
    : "Target a beginner learner.";

  return `You are a language-teaching content designer following the Pimsleur method.

Write a short quiz in ${opts.targetLanguageName} for a learner whose native language is ${opts.sourceLanguageName}.

${difficultyLine}${reviewFocusLine(opts.reviewFocus)}

Requirements:
- Exactly ${PILLARS.length} questions, one per pillar: ${PILLARS.join(", ")}.
- Across the 4 questions, use a mix of question types (multiple_choice, fill_in_blank, listening) — don't make them all the same type. At least one of each type where feasible.
- vocabulary: test recall of a common word's meaning or reading.
- grammar: test a basic sentence-pattern/particle usage.
- reading: test comprehension of a short sentence.
- kanji: test recognition/reading of a common kanji character or kanji compound.
- Keep everything at the target difficulty level, self-contained (don't reference material the learner hasn't seen — invent a fresh, standalone example for each question).
- For 'listening' questions, audioText is the sentence to be played aloud, and prompt should ask something answerable purely from hearing it.`;
}

export async function generateQuiz(opts: {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
  reviewFocus?: ReviewFocus;
}): Promise<QuizSet> {
  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(QuizSchema) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
          targetLanguageName: languageDisplayName(opts.targetLanguage),
          difficultyHint: opts.difficultyHint,
          reviewFocus: opts.reviewFocus,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Quiz generation returned unparseable output");
  }

  const { questions } = response.parsed_output;
  if (questions.length < PILLARS.length) {
    throw new Error(`Quiz generation returned only ${questions.length} questions, expected ${PILLARS.length}`);
  }

  return { questions: questions.slice(0, PILLARS.length) };
}
