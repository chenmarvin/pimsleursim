import type { GrammarPoint, ItemId, VocabItem } from "./types.js";

export function grammarDrillItemId(grammarPointId: ItemId, exampleIndex: number): ItemId {
  return `grammar:${grammarPointId}:${exampleIndex}`;
}

function joinIfBothDefined(before: string | undefined, slot: string | undefined, after: string | undefined): string | undefined {
  if (before === undefined || slot === undefined || after === undefined) return undefined;
  return before + slot + after;
}

/**
 * Expands each grammar point's substitution-drill examples into
 * VocabItem-shaped entries, so the existing spaced-repetition scheduler
 * drills grammar patterns exactly the way it drills vocabulary — Pimsleur's
 * "hear the pattern, then produce it again with a new word slotted in"
 * technique is really just a phrase drill where the phrase happens to be
 * generated from a template instead of extracted verbatim.
 */
export function buildGrammarDrillItems(grammarPoints: GrammarPoint[]): VocabItem[] {
  const items: VocabItem[] = [];
  for (const gp of grammarPoints) {
    gp.examples.forEach((example, exampleIndex) => {
      items.push({
        id: grammarDrillItemId(gp.id, exampleIndex),
        sourceLanguage: gp.sourceLanguage,
        targetLanguage: gp.targetLanguage,
        targetPhrase: gp.templateBefore + example.slotPhrase + gp.templateAfter,
        sourcePhrase: gp.translationBefore + example.slotTranslation + gp.translationAfter,
        kanaReading: joinIfBothDefined(gp.readingBefore, example.slotReading, gp.readingAfter),
        notes: gp.explanation,
        jlptLevel: gp.jlptLevel,
        kind: "grammar",
        grammarExplanation: `${gp.name} — ${gp.explanation}`,
      });
    });
  }
  return items;
}
