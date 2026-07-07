const KANJI_PROGRESS_KEY = "pimsleursim.kanjiProgress.v1";

export interface KanjiProgressState {
  coveredKanji: string[];
}

const DEFAULT_STATE: KanjiProgressState = { coveredKanji: [] };

export function loadKanjiProgress(): KanjiProgressState {
  const raw = localStorage.getItem(KANJI_PROGRESS_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<KanjiProgressState>) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function addCoveredKanji(character: string): KanjiProgressState {
  const current = loadKanjiProgress();
  if (current.coveredKanji.includes(character)) return current;
  const next: KanjiProgressState = { coveredKanji: [...current.coveredKanji, character] };
  localStorage.setItem(KANJI_PROGRESS_KEY, JSON.stringify(next));
  return next;
}
