const FURIGANA_VISIBLE_KEY = "pimsleursim.furiganaVisible.v1";

export function loadFuriganaVisible(): boolean {
  const raw = localStorage.getItem(FURIGANA_VISIBLE_KEY);
  if (raw === null) return true;
  return raw === "true";
}

export function saveFuriganaVisible(visible: boolean): void {
  localStorage.setItem(FURIGANA_VISIBLE_KEY, String(visible));
}
