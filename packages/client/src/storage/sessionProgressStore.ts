const SESSION_PROGRESS_KEY = "pimsleursim.sessionProgress.v1";
const REVIEW_CADENCE = 5;

export interface SessionProgressState {
  completedSessions: number;
}

const DEFAULT_STATE: SessionProgressState = { completedSessions: 0 };

export function loadSessionProgress(): SessionProgressState {
  const raw = localStorage.getItem(SESSION_PROGRESS_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<SessionProgressState>) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function incrementCompletedSessions(): SessionProgressState {
  const next: SessionProgressState = { completedSessions: loadSessionProgress().completedSessions + 1 };
  localStorage.setItem(SESSION_PROGRESS_KEY, JSON.stringify(next));
  return next;
}

// Every 5th session (5, 10, 15, ...) is a review session: no new
// vocab/kanji/grammar is introduced, just reinforcement of what's covered so far.
export function isReviewSession(completedSessions: number): boolean {
  return (completedSessions + 1) % REVIEW_CADENCE === 0;
}
