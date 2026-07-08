const DEFAULT_SOURCE_LANGUAGE = "zh-TW";

// The catalog can in principle mix source languages; picking the most common
// one is a reasonable default for drills that need a single source language.
export function mostCommonSourceLanguage(items: { sourceLanguage: string }[]): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.sourceLanguage, (counts.get(item.sourceLanguage) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best ?? DEFAULT_SOURCE_LANGUAGE;
}
