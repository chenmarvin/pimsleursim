export function playBase64Audio(audioBase64: string, mimeType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
    audio.addEventListener("ended", () => resolve());
    audio.addEventListener("error", () => reject(new Error("Audio playback failed")));
    audio.play().catch(reject);
  });
}
