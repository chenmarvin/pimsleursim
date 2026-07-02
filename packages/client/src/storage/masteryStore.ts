import type { MasteryMap, VocabItem } from "@pimsleursim/shared";

const CATALOG_KEY = "pimsleursim.catalog.v1";
const MASTERY_KEY = "pimsleursim.mastery.v1";

export interface DeckState {
  catalog: VocabItem[];
  masteryMap: MasteryMap;
}

export function loadDeck(): DeckState {
  const catalogRaw = localStorage.getItem(CATALOG_KEY);
  const masteryRaw = localStorage.getItem(MASTERY_KEY);
  return {
    catalog: catalogRaw ? (JSON.parse(catalogRaw) as VocabItem[]) : [],
    masteryMap: masteryRaw ? (JSON.parse(masteryRaw) as MasteryMap) : {},
  };
}

export function saveMasteryMap(masteryMap: MasteryMap): void {
  localStorage.setItem(MASTERY_KEY, JSON.stringify(masteryMap));
}

/** Merge newly extracted items into the catalog, keyed by item id, without dropping existing items. */
export function mergeCatalog(existing: VocabItem[], newItems: VocabItem[]): VocabItem[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of newItems) {
    byId.set(item.id, item);
  }
  const merged = Array.from(byId.values());
  localStorage.setItem(CATALOG_KEY, JSON.stringify(merged));
  return merged;
}
