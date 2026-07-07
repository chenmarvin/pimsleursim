import { synthesizeSpeech } from "../api/client.js";

const TEXT_ONLY_READ_DELAY_MS = 900;

// `rate` is the playback speed multiplier (1 = natural speed, <1 = slower) —
// used for listening exercises that play a line slowly once before playing
// it again at natural speed.
export async function speakText(text: string, languageCode: string, rate = 1): Promise<void> {
  const { audioBase64, mimeType } = await synthesizeSpeech({ text, languageCode });
  if (!audioBase64 || !mimeType) {
    // No server-side TTS provider configured — read it aloud with the
    // browser's built-in speech synthesis instead of flashing straight
    // through with no audio.
    await readAloudInBrowser(text, languageCode, TEXT_ONLY_READ_DELAY_MS, rate);
    return;
  }
  await playBase64Audio(audioBase64, mimeType, rate);
}

export function playBase64Audio(audioBase64: string, mimeType: string, rate = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
    audio.playbackRate = rate;
    audio.addEventListener("ended", () => resolve());
    audio.addEventListener("error", () => reject(new Error("Audio playback failed")));
    audio.play().catch(reject);
  });
}

// Uses the browser's built-in speech synthesis (Web Speech API) so lessons
// still have spoken audio when no server-side TTS provider is configured.
// Resolves instead of rejecting on unsupported browsers or synthesis errors
// so callers can just await it without needing their own fallback delay.
export function readAloudInBrowser(text: string, languageCode: string, fallbackDelayMs: number, rate = 1): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setTimeout(resolve, fallbackDelayMs / rate);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode;
    utterance.rate = rate;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
