export type JlptPhase = "N5" | "N4" | "N3" | "N2" | "N1";

export const JLPT_PHASE_ORDER: JlptPhase[] = ["N5", "N4", "N3", "N2", "N1"];

export interface JlptPhaseTarget {
  vocab: number;
  kanji: number;
  grammar: number;
}

export const JLPT_PHASE_TARGETS: Record<JlptPhase, JlptPhaseTarget> = {
  N5: { vocab: 800, kanji: 140, grammar: 80 },
  N4: { vocab: 1500, kanji: 300, grammar: 170 },
  N3: { vocab: 3500, kanji: 650, grammar: 350 },
  N2: { vocab: 6000, kanji: 1000, grammar: 500 },
  N1: { vocab: 10000, kanji: 2000, grammar: 700 },
};

export type DailyModuleKey = "vocabReview" | "vocabNew" | "grammar" | "kanji" | "reading" | "listening";

export interface DailyModuleAllocation {
  module: DailyModuleKey;
  minutes: number;
}

export interface DailyScheduleTemplate {
  totalMinutes: number;
  allocations: DailyModuleAllocation[];
}

export const DAILY_SCHEDULE_TEMPLATES: DailyScheduleTemplate[] = [
  {
    totalMinutes: 90,
    allocations: [
      { module: "vocabReview", minutes: 15 },
      { module: "vocabNew", minutes: 15 },
      { module: "grammar", minutes: 15 },
      { module: "kanji", minutes: 15 },
      { module: "reading", minutes: 15 },
      { module: "listening", minutes: 15 },
    ],
  },
  {
    totalMinutes: 30,
    allocations: [
      { module: "vocabReview", minutes: 15 },
      { module: "listening", minutes: 15 },
    ],
  },
];

// Modules with a working screen behind them. Everything else in
// DailyModuleKey renders as a "coming soon" row on the dashboard until a
// later session builds it out.
export const BUILT_MODULES: ReadonlySet<DailyModuleKey> = new Set([
  "vocabReview",
  "vocabNew",
  "grammar",
  "kanji",
  "listening",
  "reading",
]);
