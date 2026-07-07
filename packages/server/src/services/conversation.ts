import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ConversationLine, VocabItem } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// Keep dialogues short and drillable rather than full short stories.
const MIN_LINES = 4;
const MAX_LINES = 8;

// Cap how many catalog items get listed in the prompt — beyond this the
// vocabulary list itself would crowd out the instructions, and a natural
// short dialogue can't use more than a couple dozen words anyway.
const MAX_VOCAB_HINTS = 40;

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

function makeConversationSchema(isJapanese: boolean) {
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
  vocab: VocabItem[];
  sourceLanguageName: string;
  targetLanguageName: string;
  isJapanese: boolean;
}): string {
  const vocabList = opts.vocab
    .slice(0, MAX_VOCAB_HINTS)
    .map((item) => `- ${item.targetPhrase} (${item.sourcePhrase})`)
    .join("\n");

  const furiganaInstruction = opts.isJapanese
    ? "\n- For EVERY line you MUST also provide furigana: targetText split into segments so the app can show hiragana above each kanji run. See the furigana field description for the exact format."
    : "";

  return `You are a language-teaching content designer following the Pimsleur method.

Write a short, natural spoken conversation in ${opts.targetLanguageName} between two speakers, labeled "A" and "B", for a learner whose native language is ${opts.sourceLanguageName}.

Requirements:
- ${MIN_LINES}-${MAX_LINES} lines total, alternating speakers.
- Naturally weave in as many of the vocabulary items below as fit a coherent, realistic exchange — don't force in ones that don't fit, and don't pad with unrelated content just to hit the vocab count.
- Keep sentences short and conversational, at a beginner/intermediate learner's level.
- Provide a natural, idiomatic translation for every line, not a literal word-for-word gloss.${furiganaInstruction}

Vocabulary to draw from:
${vocabList}`;
}

export async function generateConversation(opts: {
  items: VocabItem[];
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<ConversationLine[]> {
  const isJapanese = opts.targetLanguage.startsWith("ja");

  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(makeConversationSchema(isJapanese)) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          vocab: opts.items,
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
          targetLanguageName: languageDisplayName(opts.targetLanguage),
          isJapanese,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Conversation generation returned unparseable output");
  }

  return response.parsed_output.lines.map((line) => ({
    ...line,
    furigana: validFurigana(line.furigana, line.targetText),
  }));
}
