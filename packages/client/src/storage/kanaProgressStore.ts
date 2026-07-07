const KANA_PROGRESS_KEY = "pimsleursim.kanaProgress.v1";

export interface KanaProgressState {
  completed: boolean;
}

const DEFAULT_STATE: KanaProgressState = { completed: false };

export function loadKanaProgress(): KanaProgressState {
  const raw = localStorage.getItem(KANA_PROGRESS_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<KanaProgressState>) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function markKanaComplete(): KanaProgressState {
  const next: KanaProgressState = { completed: true };
  localStorage.setItem(KANA_PROGRESS_KEY, JSON.stringify(next));
  return next;
}
