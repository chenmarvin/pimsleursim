export function playBase64Audio(audioBase64: string, mimeType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
    audio.addEventListener("ended", () => resolve());
    audio.addEventListener("error", () => reject(new Error("Audio playback failed")));
    audio.play().catch(reject);
  });
}

// Uses the browser's built-in speech synthesis (Web Speech API) so lessons
// still have spoken audio when no server-side TTS provider is configured.
// Resolves instead of rejecting on unsupported browsers or synthesis errors
// so callers can just await it without needing their own fallback delay.
export function readAloudInBrowser(text: string, languageCode: string, fallbackDelayMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setTimeout(resolve, fallbackDelayMs);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
