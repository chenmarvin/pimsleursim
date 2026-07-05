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

const ConversationSchema = z.object({
  lines: z.array(
    z.object({
      speaker: z.string().describe("Short speaker label, e.g. 'A' or 'B' — not a specific character name"),
      targetText: z.string().describe("One line of dialogue in the target language"),
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

function buildPrompt(opts: { vocab: VocabItem[]; sourceLanguageName: string; targetLanguageName: string }): string {
  const vocabList = opts.vocab
    .slice(0, MAX_VOCAB_HINTS)
    .map((item) => `- ${item.targetPhrase} (${item.sourcePhrase})`)
    .join("\n");

  return `You are a language-teaching content designer following the Pimsleur method.

Write a short, natural spoken conversation in ${opts.targetLanguageName} between two speakers, labeled "A" and "B", for a learner whose native language is ${opts.sourceLanguageName}.

Requirements:
- ${MIN_LINES}-${MAX_LINES} lines total, alternating speakers.
- Naturally weave in as many of the vocabulary items below as fit a coherent, realistic exchange — don't force in ones that don't fit, and don't pad with unrelated content just to hit the vocab count.
- Keep sentences short and conversational, at a beginner/intermediate learner's level.
- Provide a natural, idiomatic translation for every line, not a literal word-for-word gloss.

Vocabulary to draw from:
${vocabList}`;
}

export async function generateConversation(opts: {
  items: VocabItem[];
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<ConversationLine[]> {
  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(ConversationSchema) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          vocab: opts.items,
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
          targetLanguageName: languageDisplayName(opts.targetLanguage),
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Conversation generation returned unparseable output");
  }

  return response.parsed_output.lines;
}
