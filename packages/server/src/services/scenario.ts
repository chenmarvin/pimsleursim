import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ScenarioSet, VocabItem } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const MIN_TURNS = 3;
const MAX_TURNS = 5;

// Cap how many catalog items get listed in the prompt — see conversation.ts
// for the same rationale (beyond this the vocab list crowds out the
// instructions, and a short scene can't naturally use more than a couple
// dozen words anyway).
const MAX_VOCAB_HINTS = 40;

const BaseLineSchema = z.object({
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

function makeTurnSchema(isJapanese: boolean) {
  const lineSchema = isJapanese ? JapaneseLineSchema : LineSchema;
  return z.object({
    situationText: z.string().describe(
      "One or two sentences, in the learner's native language, framing this turn's mini real-life situation " +
      "(e.g. 'You're ordering coffee. The barista asks:').",
    ),
    npcLine: lineSchema.describe("What the other person in the scenario says this turn"),
    expectedResponses: z
      .array(lineSchema)
      .min(1)
      .max(2)
      .describe("1-2 natural, acceptable ways the learner could respond to npcLine"),
  });
}

function makeScenarioSchema(isJapanese: boolean) {
  return z.object({
    scenarioTitle: z.string().describe("Short title for the scenario, e.g. 'Ordering at a café'"),
    turns: z.array(makeTurnSchema(isJapanese)).min(MIN_TURNS).max(MAX_TURNS),
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
  vocab: VocabItem[];
  sourceLanguageName: string;
  targetLanguageName: string;
  difficultyHint?: string;
  isJapanese: boolean;
}): string {
  const vocabList = opts.vocab
    .slice(0, MAX_VOCAB_HINTS)
    .map((item) => `- ${item.targetPhrase} (${item.sourcePhrase})`)
    .join("\n");

  const difficultyLine = opts.difficultyHint
    ? `Target difficulty: ${opts.difficultyHint}.`
    : "Target a beginner learner.";

  const furiganaInstruction = opts.isJapanese
    ? "\n- For EVERY line (npcLine and every expectedResponses entry) you MUST also provide furigana: targetText split into segments so the app can show hiragana above each kanji run. See the furigana field description for the exact format."
    : "";

  const vocabSection = vocabList
    ? `\n\nVocabulary to weave in where it fits naturally (don't force it, don't pad just to hit the count):\n${vocabList}`
    : "";

  return `You are a language-teaching content designer following the Pimsleur method.

Write a short, realistic role-play scenario in ${opts.targetLanguageName} for a learner whose native language is ${opts.sourceLanguageName} to practice producing spoken/written responses in a real-life situation (e.g. ordering food, asking for directions, a phone call, shopping, checking in somewhere).

${difficultyLine}

Requirements:
- ${MIN_TURNS}-${MAX_TURNS} turns, each a coherent step in ONE continuous situation (not unrelated one-offs).
- Each turn has: a short situationText framing what's happening (in the learner's native language), one npcLine the other person says, and 1-2 expectedResponses showing natural ways the learner could reply.
- Keep sentences short and conversational, appropriate for the target difficulty.
- Provide a natural, idiomatic translation for every line, not a literal word-for-word gloss.${furiganaInstruction}${vocabSection}`;
}

export async function generateScenarioSet(opts: {
  sourceLanguage: string;
  targetLanguage: string;
  difficultyHint?: string;
  vocab?: VocabItem[];
}): Promise<ScenarioSet> {
  const isJapanese = opts.targetLanguage.startsWith("ja");

  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 4096,
    output_config: { format: zodOutputFormat(makeScenarioSchema(isJapanese)) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          vocab: opts.vocab ?? [],
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
          targetLanguageName: languageDisplayName(opts.targetLanguage),
          difficultyHint: opts.difficultyHint,
          isJapanese,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Scenario generation returned unparseable output");
  }

  const cleanLine = (line: { targetText: string; sourceText: string; furigana?: { text: string; reading?: string }[] }) => ({
    ...line,
    furigana: validFurigana(line.furigana, line.targetText),
  });

  return {
    scenarioTitle: response.parsed_output.scenarioTitle,
    turns: response.parsed_output.turns.map((turn) => ({
      situationText: turn.situationText,
      npcLine: cleanLine(turn.npcLine),
      expectedResponses: turn.expectedResponses.map(cleanLine),
    })),
  };
}
