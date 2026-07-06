import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ExtractedGrammarPoint, ExtractedItem } from "@pimsleursim/shared";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// Cap raw text fed to a single extraction call. Larger inputs are truncated
// here (not paginated) in v1 — see the MVP cut line in the project plan.
const CHAR_BUDGET = 10_000;

// Cap how many grammar points come back from a single extraction call, same
// spirit as the vocab item cap below.
const MAX_GRAMMAR_POINTS = 8;

const JlptLevelSchema = z.enum(["N5", "N4", "N3", "N2", "N1"]);

const BaseVocabItemSchema = z.object({
  targetPhrase: z.string().describe("A word or short phrase in the target language worth teaching"),
  sourcePhrase: z.string().describe("A natural, idiomatic translation into the learner's native language"),
  notes: z.string().optional().describe("Brief note, e.g. 'high-frequency greeting' or 'irregular verb form'"),
});

// For Japanese, kanaReading is REQUIRED (not optional) so that the structured
// output always forces Claude to supply it. Without it the evaluator cannot
// map kanji → hiragana and hiragana answers to kanji words are rejected.
const JapaneseVocabItemSchema = BaseVocabItemSchema.extend({
  kanaReading: z.string().describe(
    "REQUIRED: the complete hiragana reading of targetPhrase. Always provide this, even when targetPhrase is already kana. " +
    "Convert katakana to hiragana too. Examples: '食べる'→'たべる', '今日'→'きょう', 'アイスクリーム'→'あいすくりいむ', 'コーヒー'→'こおひい'"
  ),
  alternateReadings: z.array(z.string()).optional().describe(
    "Other hiragana readings that are ALSO commonly used for this exact targetPhrase and should be accepted as correct answers, " +
    "besides kanaReading. Most items have none — only list real alternates. Examples: '七' has kanaReading 'しち' and " +
    "alternateReadings ['なな']; '四' has kanaReading 'よん' and alternateReadings ['し']; '二十歳' has kanaReading 'はたち' with no alternates."
  ),
  jlptLevel: JlptLevelSchema.optional().describe(
    "The JLPT level this word is typically studied at, per standard JLPT vocabulary lists (N5=beginner ... N1=advanced). " +
    "Omit if you're not confident of the level."
  ),
});

const VocabItemSchema = BaseVocabItemSchema.extend({
  kanaReading: z.string().optional(),
  alternateReadings: z.array(z.string()).optional(),
  jlptLevel: JlptLevelSchema.optional(),
});

const GrammarExampleSchema = z.object({
  slotPhrase: z.string().describe("The target-language word/phrase filling the pattern's slot in this example, e.g. '東京' or '食べる'."),
  slotReading: z.string().optional().describe("Hiragana reading of slotPhrase (Japanese only), converting kanji/katakana to hiragana."),
  slotTranslation: z.string().describe("Natural translation of slotPhrase into the learner's native language."),
});

const GrammarPointSchema = z.object({
  name: z.string().describe("Short label for the grammar pattern, e.g. '～に行きます (go to ~)'."),
  jlptLevel: JlptLevelSchema.optional().describe("The JLPT level this grammar point is typically tested at, if you can judge it confidently."),
  explanation: z.string().describe("A one or two sentence plain-language explanation of what the pattern means and when to use it, written in the learner's native language."),
  templateBefore: z.string().describe("The fixed target-language text that comes BEFORE the slot (may be an empty string)."),
  templateAfter: z.string().describe("The fixed target-language text that comes AFTER the slot (may be an empty string)."),
  readingBefore: z.string().optional().describe("Hiragana reading of templateBefore, if it contains kanji/katakana (Japanese only)."),
  readingAfter: z.string().optional().describe("Hiragana reading of templateAfter, if it contains kanji/katakana (Japanese only)."),
  translationBefore: z.string().describe("Native-language text before the slot's translation, matching templateBefore's meaning (may be an empty string)."),
  translationAfter: z.string().describe("Native-language text after the slot's translation, matching templateAfter's meaning (may be an empty string)."),
  examples: z.array(GrammarExampleSchema).describe(
    "2 to 4 distinct, high-frequency slot-filler examples for substitution drilling — prefer words already present in the extracted vocabulary."
  ),
});

function makeExtractionSchema(isJapanese: boolean) {
  const itemSchema = isJapanese ? JapaneseVocabItemSchema : VocabItemSchema;
  return z.object({
    items: z.array(itemSchema),
    grammarPoints: z.array(GrammarPointSchema).optional(),
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
  rawText: string;
  sourceLanguageName: string;
  targetLanguageName: string;
  targetLanguageCode: string;
  maxItems: number;
}): string {
  const isJapanese = opts.targetLanguageCode.startsWith("ja");
  const kanaInstruction = isJapanese
    ? "\n- For EVERY Japanese item you MUST provide kanaReading: the complete hiragana reading (convert kanji AND katakana to hiragana). Examples: '食べる'→'たべる', '今日'→'きょう', 'アイスクリーム'→'あいすくりいむ', 'コーヒー'→'こおひい'. Omitting kanaReading will break the app." +
      "\n- If the item has another hiragana reading that Japanese speakers also commonly use interchangeably (e.g. numbers like 七/しち which is equally often read なな, or 四/よん which is equally often read し), list it in alternateReadings so either answer is accepted. Leave alternateReadings empty for the (much more common) case where there's only one natural reading." +
      "\n- Tag each item's jlptLevel (N5 easiest through N1 hardest) using standard JLPT vocabulary lists, when you can judge it confidently; omit it otherwise."
    : "";

  const grammarInstruction = isJapanese
    ? `\n\nAlso identify up to ${MAX_GRAMMAR_POINTS} recurring GRAMMAR PATTERNS in the text (e.g. a particle usage, a verb conjugation, a sentence-ending pattern) suitable for JLPT prep and for Pimsleur-style substitution drilling, where the learner hears the pattern with one word slotted in, then must produce it again with a different word slotted in. For each grammar point, split it into the fixed text immediately before and after the slot — in the target script, in its hiragana reading, and in the equivalent native-language template — plus 2-4 example filler words (preferring words already in the extracted vocabulary) with their readings and translations. Tag its JLPT level if you can judge it confidently. Only include patterns the text actually supports with clear examples; leave grammarPoints empty rather than inventing one.`
    : "\n\nLeave grammarPoints empty — grammar-pattern drilling is only supported for Japanese right now.";

  return `You are a language-teaching content designer following the Pimsleur method.

The text below is written in ${opts.targetLanguageName}, or contains ${opts.targetLanguageName} vocabulary/phrases the learner wants to study (it may be raw prose, or a messy, informally-formatted vocabulary list with inconsistent punctuation — extract from it either way). The learner's native language is ${opts.sourceLanguageName}.

Extract up to ${opts.maxItems} teachable vocabulary items and short phrases, suitable for spoken-repetition drilling:
- Prefer natural, useful phrases (2-5 words) over single isolated words when the source supports it — Pimsleur teaches whole utterances a learner would actually say, not word lists. If the source is itself a vocabulary list, individual words/short phrases are fine.
- Prioritize high-frequency, broadly useful vocabulary over rare or text-specific terms.
- Skip proper nouns unless they are common vocabulary words.
- Deduplicate near-identical items (different inflections of the same core phrase).
- For each item, provide a natural idiomatic translation, not a literal word-for-word gloss. If the source text already gives a translation/reading, use it as the basis but clean it up into a clear, natural phrase pair.${kanaInstruction}${grammarInstruction}

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
}): Promise<{
  items: ExtractedItem[];
  grammarPoints: ExtractedGrammarPoint[];
  truncated: boolean;
  processedCharCount: number;
  totalCharCount: number;
}> {
  const totalCharCount = opts.rawText.length;
  const truncated = totalCharCount > CHAR_BUDGET;
  const rawText = truncated ? opts.rawText.slice(0, CHAR_BUDGET) : opts.rawText;

  const isJapanese = opts.targetLanguage.startsWith("ja");
  const extractionSchema = makeExtractionSchema(isJapanese);

  const response = await client.messages.parse({
    model: config.claudeModel,
    max_tokens: 4096,
    output_config: { format: zodOutputFormat(extractionSchema) },
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

  // Caps enforced here, not via schema — structured outputs doesn't support
  // maxItems/minItems array constraints.
  const items: ExtractedItem[] = response.parsed_output.items.slice(0, opts.maxItems).map((item) => ({
    id: randomUUID(),
    targetPhrase: item.targetPhrase,
    sourcePhrase: item.sourcePhrase,
    notes: item.notes,
    kanaReading: item.kanaReading,
    alternateReadings: item.alternateReadings,
    jlptLevel: item.jlptLevel,
  }));

  const grammarPoints: ExtractedGrammarPoint[] = (response.parsed_output.grammarPoints ?? [])
    .slice(0, MAX_GRAMMAR_POINTS)
    .map((gp) => ({ id: randomUUID(), ...gp }));

  return { items, grammarPoints, truncated, processedCharCount: rawText.length, totalCharCount };
}
