import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { GrammarPoint } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const SENTENCES_PER_POINT = 4;

// Structured outputs doesn't support array length constraints (see the same
// note in extraction.ts), so "exactly 4" is enforced by prompt instruction
// plus the defensive check below, not z.array(...).length(4).
const GrammarSchema = z.object({
  patternName: z.string().describe("Short name of the grammar pattern being taught, e.g. '〜てはいけない (must not)'"),
  explanation: z.string().describe("One or two sentences explaining the pattern, in the learner's native language"),
  sentences: z.array(
    z.object({
      label: z.string().describe("Short label for this variation, in the learner's native language, e.g. 'Affirmative, present'"),
      targetText: z.string().describe("One example sentence in the target language demonstrating the pattern"),
      sourceText: z.string().describe("Natural, idiomatic translation of targetText into the learner's native language"),
    }),
  ),
});

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
}): string {
  const difficultyLine = opts.difficultyHint
    ? `Target difficulty: ${opts.difficultyHint}. Pick a grammar pattern a learner at this level would be studying next.`
    : "Pick a foundational, high-frequency grammar pattern suitable for a beginner.";

  const coveredLine =
    opts.coveredPatterns.length > 0
      ? `Do NOT reuse any of these already-covered patterns: ${opts.coveredPatterns.join(", ")}.`
      : "";

  return `You are a language-teaching content designer following the Pimsleur method.

Teach ONE grammar pattern in ${opts.targetLanguageName} to a learner whose native language is ${opts.sourceLanguageName}.

${difficultyLine}
${coveredLine}

Requirements:
- Write a short (1-2 sentence) explanation of the pattern, in the learner's native language (${opts.sourceLanguageName}).
- Provide exactly ${SENTENCES_PER_POINT} example sentences drilling the pattern, each with a short label and a natural idiomatic translation.
- If the pattern is a conjugable adjective, copula, or verb form, make the 4 sentences the same base sentence transformed across affirmative/negative x present/past (in that order: affirmative-present, negative-present, affirmative-past, negative-past) — e.g. "Today is hot" -> "Today is not hot" -> "Yesterday was hot" -> "Yesterday was not hot".
- Otherwise (e.g. particles, comparisons, conditionals, and other patterns that don't naturally conjugate that way), provide 4 varied natural example sentences that each clearly demonstrate the pattern in a different realistic context.
- Keep sentences short and conversational, at the target difficulty level.`;
}

export async function generateGrammarDrill(opts: {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
  coveredPatterns: string[];
}): Promise<GrammarPoint> {
  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(GrammarSchema) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
          targetLanguageName: languageDisplayName(opts.targetLanguage),
          difficultyHint: opts.difficultyHint,
          coveredPatterns: opts.coveredPatterns,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Grammar drill generation returned unparseable output");
  }

  const { patternName, explanation, sentences } = response.parsed_output;
  if (sentences.length < SENTENCES_PER_POINT) {
    throw new Error(`Grammar drill generation returned only ${sentences.length} sentences, expected ${SENTENCES_PER_POINT}`);
  }

  return { patternName, explanation, sentences: sentences.slice(0, SENTENCES_PER_POINT) };
}
