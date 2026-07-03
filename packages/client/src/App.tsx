import { useState } from "react";
import { LanguageSwitcher } from "./components/LanguageSwitcher.js";
import { UiLanguageProvider } from "./i18n/useUiLanguage.js";
import { LessonPlayerScreen } from "./screens/LessonPlayerScreen.js";
import { UploadConfigScreen, type LessonReadyPayload } from "./screens/UploadConfigScreen.js";

type Screen = { name: "upload" } | { name: "lesson"; payload: LessonReadyPayload };

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 16;

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "upload" });
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  const decreaseFont = () => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 2));
  const increaseFont = () => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 2));

  return (
    <UiLanguageProvider>
      <div style={{ fontSize: `${fontSize}px` }}>
        <div style={{ display: "flex", gap: "0.5em", alignItems: "center", marginBottom: "0.5em" }}>
          <span style={{ fontSize: "0.85em", color: "#555" }}>Font:</span>
          <button onClick={decreaseFont} disabled={fontSize <= MIN_FONT_SIZE} aria-label="Decrease font size">A−</button>
          <button onClick={increaseFont} disabled={fontSize >= MAX_FONT_SIZE} aria-label="Increase font size">A+</button>
          <div style={{ flex: 1 }} />
          <LanguageSwitcher />
        </div>
        {screen.name === "lesson" ? (
          <LessonPlayerScreen
            initialSteps={screen.payload.steps}
            initialMasteryMap={screen.payload.masteryMap}
            sourceLanguage={screen.payload.sourceLanguage}
            targetLanguage={screen.payload.targetLanguage}
            onFinish={() => setScreen({ name: "upload" })}
          />
        ) : (
          <UploadConfigScreen onLessonReady={(payload) => setScreen({ name: "lesson", payload })} />
        )}
      </div>
    </UiLanguageProvider>
  );
}
