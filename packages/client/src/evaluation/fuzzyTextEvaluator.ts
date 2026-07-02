import type { EvaluationResult, ResponseEvaluator } from "./ResponseEvaluator.js";

const DEFAULT_THRESHOLD = 0.8;

// Katakana U+30A1-U+30F6 map to hiragana U+3041-U+3096 via -0x60 offset.
function katakanaToHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// The prolonged sound mark ー (U+30FC) stays as-is after katakanaToHiragana
// because it's outside the katakana range. Expand it to the vowel of the
// preceding hiragana so e.g. コーヒー → こおひい, クリーム → くりいむ.
const HIRAGANA_VOWEL: Record<string, string> = {
  'あ':'あ','い':'い','う':'う','え':'え','お':'お',
  'か':'あ','き':'い','く':'う','け':'え','こ':'お',
  'さ':'あ','し':'い','す':'う','せ':'え','そ':'お',
  'た':'あ','ち':'い','つ':'う','て':'え','と':'お',
  'な':'あ','に':'い','ぬ':'う','ね':'え','の':'お',
  'は':'あ','ひ':'い','ふ':'う','へ':'え','ほ':'お',
  'ま':'あ','み':'い','む':'う','め':'え','も':'お',
  'ら':'あ','り':'い','る':'う','れ':'え','ろ':'お',
  'や':'あ','ゆ':'う','よ':'お',
  'わ':'あ','を':'お',
  'が':'あ','ぎ':'い','ぐ':'う','げ':'え','ご':'お',
  'ざ':'あ','じ':'い','ず':'う','ぜ':'え','ぞ':'お',
  'だ':'あ','ぢ':'い','づ':'う','で':'え','ど':'お',
  'ば':'あ','び':'い','ぶ':'う','べ':'え','ぼ':'お',
  'ぱ':'あ','ぴ':'い','ぷ':'う','ぺ':'え','ぽ':'お',
  'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お',
  'ゃ':'あ','ゅ':'う','ょ':'お',
};

function expandLongVowel(text: string): string {
  let result = '';
  for (const ch of text) {
    if (ch === 'ー') {
      const prev = [...result].at(-1) ?? '';
      result += HIRAGANA_VOWEL[prev] ?? ch;
    } else {
      result += ch;
    }
  }
  return result;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "") // strip punctuation/whitespace
    .trim();
}

function normalizeJapanese(text: string): string {
  return normalize(expandLongVowel(katakanaToHiragana(text)));
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) dist[i][0] = i;
  for (let j = 0; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }

  return dist[rows - 1][cols - 1];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - levenshteinDistance(a, b) / maxLen;
}

export class FuzzyTextEvaluator implements ResponseEvaluator {
  readonly name = "fuzzy-text";

  constructor(private readonly threshold: number = DEFAULT_THRESHOLD) {}

  async evaluate(userInput: string, expectedPhrase: string, languageCode: string, kanaReading?: string): Promise<EvaluationResult> {
    const normalizedActual = normalize(userInput);
    const normalizedExpected = normalize(expectedPhrase);
    let score = similarity(normalizedActual, normalizedExpected);

    // For Japanese, also compare with full kana normalization (katakana→hiragana
    // + long vowel expansion) so hiragana, katakana, and kanji are all accepted.
    if (languageCode.startsWith("ja")) {
      const hiraganaActual = normalizeJapanese(userInput);
      const hiraganaExpected = normalizeJapanese(expectedPhrase);
      score = Math.max(score, similarity(hiraganaActual, hiraganaExpected));

      // If extraction provided a hiragana reading (for kanji phrases), also
      // compare the user's normalized input against it.
      if (kanaReading) {
        const hiraganaReading = normalizeJapanese(kanaReading);
        score = Math.max(score, similarity(hiraganaActual, hiraganaReading));
        score = Math.max(score, similarity(normalizedActual, normalize(kanaReading)));
      }
    }

    return {
      correct: score >= this.threshold,
      score,
      normalizedExpected,
      normalizedActual,
    };
  }
}
