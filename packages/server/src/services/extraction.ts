import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ExtractedItem } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// Cap raw text fed to a single extraction call. Larger inputs are truncated
// here (not paginated) in v1 — see the MVP cut line in the project plan.
const CHAR_BUDGET = 10_000;

const VocabItemSchema = z.object({
  targetPhrase: z.string().describe("A word or short phrase in the target language worth teaching"),
  sourcePhrase: z.string().describe("A natural, idiomatic translation into the learner's native language"),
  notes: z.string().optional().describe("Brief note, e.g. 'high-frequency greeting' or 'irregular verb form'"),
  kanaReading: z.string().optional().describe("For Japanese only: the full hiragana reading of targetPhrase (e.g. if targetPhrase is '食べる', kanaReading is 'たべる'). Omit for non-Japanese languages."),
});
const ExtractionResultSchema = z.object({ items: z.array(VocabItemSchema) });

function languageDisplayName(bcp47: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(bcp47) ?? bcp47;
  } catch {
    return bcp47;
  }
}

function buildPrompt(opts: {
  rawText: string;
  sourceLanguageName: string;
  targetLanguageName: string;
  targetLanguageCode: string;
  maxItems: number;
}): string {
  const isJapanese = opts.targetLanguageCode.startsWith("ja");
  const kanaInstruction = isJapanese
    ? "\n- For each Japanese item, also provide kanaReading: the complete hiragana reading of the targetPhrase (e.g. targetPhrase '食べる' → kanaReading 'たべる', targetPhrase '今日' → kanaReading 'きょう'). This allows learners to answer in hiragana, katakana, or kanji."
    : "";

  return `You are a language-teaching content designer following the Pimsleur method.

The text below is written in ${opts.targetLanguageName}, or contains ${opts.targetLanguageName} vocabulary/phrases the learner wants to study (it may be raw prose, or a messy, informally-formatted vocabulary list with inconsistent punctuation — extract from it either way). The learner's native language is ${opts.sourceLanguageName}.

Extract up to ${opts.maxItems} teachable vocabulary items and short phrases, suitable for spoken-repetition drilling:
- Prefer natural, useful phrases (2-5 words) over single isolated words when the source supports it — Pimsleur teaches whole utterances a learner would actually say, not word lists. If the source is itself a vocabulary list, individual words/short phrases are fine.
- Prioritize high-frequency, broadly useful vocabulary over rare or text-specific terms.
- Skip proper nouns unless they are common vocabulary words.
- Deduplicate near-identical items (different inflections of the same core phrase).
- For each item, provide a natural idiomatic translation, not a literal word-for-word gloss. If the source text already gives a translation/reading, use it as the basis but clean it up into a clear, natural phrase pair.${kanaInstruction}

Text:
"""
${opts.rawText}
"""`;
}

export async function extractVocabulary(opts: {
  rawText: string;
  sourceLanguage: string;
  targetLanguage: string;
  maxItems: number;
}): Promise<{ items: ExtractedItem[]; truncated: boolean; processedCharCount: number; totalCharCount: number }> {
  const totalCharCount = opts.rawText.length;
  const truncated = totalCharCount > CHAR_BUDGET;
  const rawText = truncated ? opts.rawText.slice(0, CHAR_BUDGET) : opts.rawText;

  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 4096,
    output_config: { format: zodOutputFormat(ExtractionResultSchema) },
    messages: [
      {
        role: "user",
        content: buildPrompt({
          rawText,
          sourceLanguageName: languageDisplayName(opts.sourceLanguage),
          targetLanguageName: languageDisplayName(opts.targetLanguage),
          targetLanguageCode: opts.targetLanguage,
          maxItems: opts.maxItems,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Vocabulary extraction returned unparseable output");
  }

  // Cap enforced here, not via schema — structured outputs doesn't support
  // maxItems/minItems array constraints.
  const items: ExtractedItem[] = response.parsed_output.items.slice(0, opts.maxItems).map((item) => ({
    id: randomUUID(),
    targetPhrase: item.targetPhrase,
    sourcePhrase: item.sourcePhrase,
    notes: item.notes,
    kanaReading: item.kanaReading,
  }));

  return { items, truncated, processedCharCount: rawText.length, totalCharCount };
}
