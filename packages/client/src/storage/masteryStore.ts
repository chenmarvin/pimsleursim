import type { GrammarPoint, MasteryMap, VocabItem } from "@pimsleursim/shared";

const CATALOG_KEY = "pimsleursim.catalog.v1";
const GRAMMAR_KEY = "pimsleursim.grammar.v1";
const MASTERY_KEY = "pimsleursim.mastery.v1";

export interface DeckState {
  catalog: VocabItem[];
  grammarPoints: GrammarPoint[];
  masteryMap: MasteryMap;
}

export function loadDeck(): DeckState {
  const catalogRaw = localStorage.getItem(CATALOG_KEY);
  const grammarRaw = localStorage.getItem(GRAMMAR_KEY);
  const masteryRaw = localStorage.getItem(MASTERY_KEY);
  return {
    catalog: catalogRaw ? (JSON.parse(catalogRaw) as VocabItem[]) : [],
    grammarPoints: grammarRaw ? (JSON.parse(grammarRaw) as GrammarPoint[]) : [],
    masteryMap: masteryRaw ? (JSON.parse(masteryRaw) as MasteryMap) : {},
  };
}

export function saveMasteryMap(masteryMap: MasteryMap): void {
  localStorage.setItem(MASTERY_KEY, JSON.stringify(masteryMap));
}

// Extraction mints a fresh random id per call, so the same vocab phrase
// re-extracted from a different upload (e.g. a word appearing in two
// lessons) would otherwise land in the catalog twice under different ids,
// each with its own independent (and initially empty) mastery tracking.
function dedupeKey(item: VocabItem): string {
  return `${item.targetLanguage}::${item.targetPhrase.trim().toLowerCase()}`;
}

/**
 * Merge newly extracted items into the catalog, keyed by item id, without
 * dropping existing items. New items whose targetPhrase already exists in
 * the catalog are skipped so the existing entry's id (and mastery progress)
 * is preserved instead of being shadowed by a duplicate.
 */
export function mergeCatalog(existing: VocabItem[], newItems: VocabItem[]): VocabItem[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  const byPhrase = new Map(existing.map((item) => [dedupeKey(item), item]));
  for (const item of newItems) {
    const key = dedupeKey(item);
    if (byPhrase.has(key)) continue;
    byId.set(item.id, item);
    byPhrase.set(key, item);
  }
  const merged = Array.from(byId.values());
  localStorage.setItem(CATALOG_KEY, JSON.stringify(merged));
  return merged;
}

function grammarDedupeKey(gp: GrammarPoint): string {
  return `${gp.targetLanguage}::${gp.name.trim().toLowerCase()}`;
}

/** Same dedupe-by-content strategy as mergeCatalog, keyed on the grammar point's name. */
export function mergeGrammarPoints(existing: GrammarPoint[], newPoints: GrammarPoint[]): GrammarPoint[] {
  const byId = new Map(existing.map((gp) => [gp.id, gp]));
  const byName = new Map(existing.map((gp) => [grammarDedupeKey(gp), gp]));
  for (const gp of newPoints) {
    const key = grammarDedupeKey(gp);
    if (byName.has(key)) continue;
    byId.set(gp.id, gp);
    byName.set(key, gp);
  }
  const merged = Array.from(byId.values());
  localStorage.setItem(GRAMMAR_KEY, JSON.stringify(merged));
  return merged;
}
