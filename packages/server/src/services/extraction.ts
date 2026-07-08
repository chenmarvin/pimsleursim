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

const BaseVocabItemSchema = z.object({
  targetPhrase: z.string().describe("A word or short phrase in the target language worth teaching"),
  sourcePhrase: z.string().describe("A natural, idiomatic translation into the learner's native language"),
  notes: z.string().optional().describe("Brief note, e.g. 'high-frequency greeting' or 'irregular verb form'"),
  englishTranslation: z.string().describe(
    "English translation of targetPhrase, kept as a fixed reference translation regardless of whether the learner's " +
    "native language is already English."
  ),
  exampleSentence: z.string().describe("A short, natural example sentence in the target language that uses targetPhrase"),
  exampleTranslation: z.string().describe("Natural, idiomatic translation of exampleSentence into the learner's native language"),
  commonMistake: z.string().optional().describe(
    "A common mistake learners (especially from the learner's native-language background) make with this word or phrase, " +
    "in the learner's native language. Omit entirely if there isn't a notable one."
  ),
  memoryTip: z.string().optional().describe(
    "A short mnemonic or memory aid to help remember this word or phrase, in the learner's native language. Omit " +
    "entirely if there isn't a good one."
  ),
  chineseDifference: z.string().optional().describe(
    "Only for learners whose native language uses Chinese characters: if targetPhrase is a 'false friend' — shares " +
    "characters with a Chinese word/phrase but differs meaningfully in meaning or usage — explain the difference here, " +
    "in the learner's native language. Omit entirely if there's no meaningful difference worth flagging."
  ),
});

const FuriganaSegmentSchema = z.object({
  text: z.string().describe("Exact substring of the annotated text this segment covers"),
  reading: z.string().optional().describe(
    "Hiragana reading of this segment. Include ONLY if text contains kanji; omit for kana/punctuation/romaji segments."
  ),
});

const FURIGANA_INSTRUCTION = (fieldName: string) =>
  `REQUIRED: split ${fieldName} into segments for furigana display. Concatenating every segment's text, in order, ` +
  "MUST reconstruct it EXACTLY (same characters, same order, no gaps or overlaps). Give each contiguous run of kanji " +
  "its own segment with its hiragana reading; keep kana/punctuation/other characters as separate segment(s) with no " +
  "reading. Example: '今日は天気がいいですね' → " +
  '[{"text":"今日","reading":"きょう"},{"text":"は"},{"text":"天気","reading":"てんき"},{"text":"が"},{"text":"いいですね"}].';

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
  furigana: z.array(FuriganaSegmentSchema).describe(FURIGANA_INSTRUCTION("targetPhrase")),
  exampleFurigana: z.array(FuriganaSegmentSchema).describe(FURIGANA_INSTRUCTION("exampleSentence")),
});

const VocabItemSchema = BaseVocabItemSchema.extend({
  kanaReading: z.string().optional(),
  alternateReadings: z.array(z.string()).optional(),
  furigana: z.array(FuriganaSegmentSchema).optional(),
  exampleFurigana: z.array(FuriganaSegmentSchema).optional(),
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

function makeExtractionSchema(isJapanese: boolean) {
  const itemSchema = isJapanese ? JapaneseVocabItemSchema : VocabItemSchema;
  return z.object({ items: z.array(itemSchema) });
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
      "\n- For EVERY Japanese item you MUST also provide furigana: targetPhrase split into segments so the app can show hiragana above each kanji run. See the furigana field description for the exact format." +
      "\n- For EVERY Japanese item you MUST also provide exampleFurigana: exampleSentence split into segments the same way. See the exampleFurigana field description for the exact format."
    : "";

  return `You are a language-teaching content designer following the Pimsleur method.

The text below is written in ${opts.targetLanguageName}, or contains ${opts.targetLanguageName} vocabulary/phrases the learner wants to study (it may be raw prose, or a messy, informally-formatted vocabulary list with inconsistent punctuation — extract from it either way). The learner's native language is ${opts.sourceLanguageName}.

Extract up to ${opts.maxItems} teachable vocabulary items and short phrases, suitable for spoken-repetition drilling:
- Prefer natural, useful phrases (2-5 words) over single isolated words when the source supports it — Pimsleur teaches whole utterances a learner would actually say, not word lists. If the source is itself a vocabulary list, individual words/short phrases are fine.
- Prioritize high-frequency, broadly useful vocabulary over rare or text-specific terms.
- Skip proper nouns unless they are common vocabulary words.
- Deduplicate near-identical items (different inflections of the same core phrase).
- For each item, provide a natural idiomatic translation, not a literal word-for-word gloss. If the source text already gives a translation/reading, use it as the basis but clean it up into a clear, natural phrase pair.
- For each item, also provide: englishTranslation (an English gloss, even if the learner's native language is already English or is something else entirely); one short exampleSentence in the target language using the item, with its exampleTranslation into the learner's native language; and, only when genuinely useful, a commonMistake and/or memoryTip in the learner's native language. Leave commonMistake/memoryTip out entirely when there isn't a notable one — don't force one for every item.
- If the learner's native language uses Chinese characters (e.g. Traditional Chinese) and targetPhrase is a "false friend" relative to a Chinese word/phrase that shares characters with it — same or similar appearance but a meaningfully different meaning or usage — explain the difference in chineseDifference, in the learner's native language. Omit chineseDifference entirely when there's no meaningful difference worth flagging (most items have none).${kanaInstruction}

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

  const isJapanese = opts.targetLanguage.startsWith("ja");
  const extractionSchema = makeExtractionSchema(isJapanese);

  // The Anthropic SDK refuses non-streaming calls whose max_tokens implies
  // the request could run past its 10-minute timeout — and the max_tokens
  // this needs (see below) crosses that line well before maxItems=60, so
  // this has to stream rather than use messages.parse()'s plain request.
  const stream = client.messages.stream({
    model: config.claudeModel,
    // Each Japanese item now carries kanaReading/alternateReadings/furigana/
    // exampleFurigana plus englishTranslation/exampleSentence/exampleTranslation/
    // commonMistake/memoryTip/chineseDifference — a fixed cap kept getting
    // outgrown as maxItems (up to 60) and per-item verbosity (heavy-kanji
    // content tokenizes worse) varied, and a truncated response breaks
    // structured-output JSON parsing entirely (mid-string cutoff). Scale the
    // budget with maxItems instead of guessing another fixed constant.
    max_tokens: Math.min(32000, 2000 + opts.maxItems * 700),
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
  const response = await stream.finalMessage();

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
    alternateReadings: item.alternateReadings,
    furigana: validFurigana(item.furigana, item.targetPhrase),
    englishTranslation: item.englishTranslation,
    exampleSentence: item.exampleSentence,
    exampleTranslation: item.exampleTranslation,
    exampleFurigana: validFurigana(item.exampleFurigana, item.exampleSentence),
    commonMistake: item.commonMistake,
    memoryTip: item.memoryTip,
    chineseDifference: item.chineseDifference,
  }));

  return { items, truncated, processedCharCount: rawText.length, totalCharCount };
}
