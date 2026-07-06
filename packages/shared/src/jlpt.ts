import type { JlptLevel } from "./types.js";

export const JLPT_LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

const JLPT_RANK: Record<JlptLevel, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };

// Untagged items (jlptLevel undefined) always pass — JLPT filtering narrows
// down tagged content, it doesn't hide vocab/grammar the extractor couldn't
// confidently level.
export function isAtOrBelowJlptLevel(itemLevel: JlptLevel | undefined, maxLevel: JlptLevel): boolean {
  if (!itemLevel) return true;
  return JLPT_RANK[itemLevel] <= JLPT_RANK[maxLevel];
}
