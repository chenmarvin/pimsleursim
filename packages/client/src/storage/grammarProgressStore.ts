const GRAMMAR_PROGRESS_KEY = "pimsleursim.grammarProgress.v1";

export interface GrammarProgressState {
  coveredPatterns: string[];
}

const DEFAULT_STATE: GrammarProgressState = { coveredPatterns: [] };

export function loadGrammarProgress(): GrammarProgressState {
  const raw = localStorage.getItem(GRAMMAR_PROGRESS_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<GrammarProgressState>) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function addCoveredPattern(patternName: string): GrammarProgressState {
  const current = loadGrammarProgress();
  if (current.coveredPatterns.includes(patternName)) return current;
  const next: GrammarProgressState = { coveredPatterns: [...current.coveredPatterns, patternName] };
  localStorage.setItem(GRAMMAR_PROGRESS_KEY, JSON.stringify(next));
  return next;
}
