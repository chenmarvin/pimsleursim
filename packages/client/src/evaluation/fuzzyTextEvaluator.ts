import type { EvaluationResult, ResponseEvaluator } from "./ResponseEvaluator.js";

const DEFAULT_THRESHOLD = 0.8;

// Katakana U+30A1-U+30F6 map to hiragana U+3041-U+3096 via -0x60 offset.
function katakanaToHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
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
  return normalize(katakanaToHiragana(text));
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

    // For Japanese, also compare with katakana→hiragana normalization so that
    // hiragana, katakana, and kanji answers are all accepted interchangeably.
    if (languageCode.startsWith("ja")) {
      const hiraganaActual = normalizeJapanese(userInput);
      const hiraganaExpected = normalizeJapanese(expectedPhrase);
      score = Math.max(score, similarity(hiraganaActual, hiraganaExpected));

      // If the extraction provided a hiragana reading (for kanji phrases),
      // also compare the user's hiragana-normalized input against it.
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
