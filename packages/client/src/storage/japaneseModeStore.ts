import type { JlptPhase } from "../japanese/curriculum.js";

const JAPANESE_MODE_KEY = "pimsleursim.japaneseMode.v1";

export interface JapaneseModeState {
  enabled: boolean;
  currentPhase: JlptPhase;
}

const DEFAULT_STATE: JapaneseModeState = { enabled: false, currentPhase: "N5" };

export function loadJapaneseMode(): JapaneseModeState {
  const raw = localStorage.getItem(JAPANESE_MODE_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<JapaneseModeState>) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveJapaneseMode(state: JapaneseModeState): void {
  localStorage.setItem(JAPANESE_MODE_KEY, JSON.stringify(state));
}
