import { useState } from "react";
import { LanguageSwitcher } from "./components/LanguageSwitcher.js";
import { FuriganaVisibilityProvider, useFuriganaVisibility } from "./i18n/useFuriganaVisibility.js";
import { useUiLanguage, UiLanguageProvider } from "./i18n/useUiLanguage.js";
import { DailySessionScreen } from "./screens/DailySessionScreen.js";
import { DashboardScreen } from "./screens/DashboardScreen.js";
import { GrammarDrillScreen, type GrammarDrillPayload } from "./screens/GrammarDrillScreen.js";
import { KanaScreen } from "./screens/KanaScreen.js";
import { KanjiDrillScreen, type KanjiDrillPayload } from "./screens/KanjiDrillScreen.js";
import { LessonPlayerScreen } from "./screens/LessonPlayerScreen.js";
import { ListeningScreen, type ListeningDrillPayload } from "./screens/ListeningScreen.js";
import { ReadingScreen, type ReadingDrillPayload } from "./screens/ReadingScreen.js";
import { UploadConfigScreen, type LessonReadyPayload } from "./screens/UploadConfigScreen.js";
import { loadJapaneseMode, saveJapaneseMode } from "./storage/japaneseModeStore.js";

type HomeScreenName = "upload" | "dashboard";
type Screen =
  | { name: HomeScreenName }
  | { name: "lesson"; payload: LessonReadyPayload }
  | { name: "grammarDrill"; payload: GrammarDrillPayload }
  | { name: "kanjiDrill"; payload: KanjiDrillPayload }
  | { name: "listeningDrill"; payload: ListeningDrillPayload }
  | { name: "readingDrill"; payload: ReadingDrillPayload }
  | { name: "session" }
  | { name: "kana" };

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 16;

function homeScreenFor(enabled: boolean): HomeScreenName {
  return enabled ? "dashboard" : "upload";
}

function AppShell() {
  const { t } = useUiLanguage();
  const { furiganaVisible, toggleFuriganaVisible } = useFuriganaVisibility();
  const [japaneseModeEnabled, setJapaneseModeEnabled] = useState(() => loadJapaneseMode().enabled);
  const [screen, setScreen] = useState<Screen>(() => ({ name: homeScreenFor(loadJapaneseMode().enabled) }));
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  const decreaseFont = () => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 2));
  const increaseFont = () => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 2));

  function toggleJapaneseMode() {
    const next = !japaneseModeEnabled;
    saveJapaneseMode({ ...loadJapaneseMode(), enabled: next });
    setJapaneseModeEnabled(next);
    setScreen({ name: homeScreenFor(next) });
  }

  return (
    <div style={{ fontSize: `${fontSize}px` }}>
      <div style={{ display: "flex", gap: "0.5em", alignItems: "center", marginBottom: "0.5em" }}>
        <span style={{ fontSize: "0.85em", color: "#555" }}>Font:</span>
        <button onClick={decreaseFont} disabled={fontSize <= MIN_FONT_SIZE} aria-label="Decrease font size">A−</button>
        <button onClick={increaseFont} disabled={fontSize >= MAX_FONT_SIZE} aria-label="Increase font size">A+</button>
        <button onClick={toggleJapaneseMode}>{t(japaneseModeEnabled ? "jlptModeOn" : "jlptModeOff")}</button>
        <button onClick={toggleFuriganaVisible}>{t(furiganaVisible ? "furiganaOn" : "furiganaOff")}</button>
        <div style={{ flex: 1 }} />
        <LanguageSwitcher />
      </div>
      {screen.name === "lesson" ? (
        <LessonPlayerScreen
          initialSteps={screen.payload.steps}
          initialMasteryMap={screen.payload.masteryMap}
          sourceLanguage={screen.payload.sourceLanguage}
          targetLanguage={screen.payload.targetLanguage}
          onFinish={() => setScreen({ name: homeScreenFor(japaneseModeEnabled) })}
          finishLabel={t(japaneseModeEnabled ? "backToDashboard" : "backToUpload")}
        />
      ) : screen.name === "grammarDrill" ? (
        <GrammarDrillScreen
          point={screen.payload.point}
          sourceLanguage={screen.payload.sourceLanguage}
          targetLanguage={screen.payload.targetLanguage}
          onFinish={() => setScreen({ name: homeScreenFor(japaneseModeEnabled) })}
        />
      ) : screen.name === "kanjiDrill" ? (
        <KanjiDrillScreen
          entry={screen.payload.entry}
          sourceLanguage={screen.payload.sourceLanguage}
          targetLanguage={screen.payload.targetLanguage}
          onFinish={() => setScreen({ name: homeScreenFor(japaneseModeEnabled) })}
        />
      ) : screen.name === "listeningDrill" ? (
        <ListeningScreen
          script={screen.payload.script}
          sourceLanguage={screen.payload.sourceLanguage}
          targetLanguage={screen.payload.targetLanguage}
          onFinish={() => setScreen({ name: homeScreenFor(japaneseModeEnabled) })}
        />
      ) : screen.name === "readingDrill" ? (
        <ReadingScreen
          passage={screen.payload.passage}
          sourceLanguage={screen.payload.sourceLanguage}
          targetLanguage={screen.payload.targetLanguage}
          onFinish={() => setScreen({ name: homeScreenFor(japaneseModeEnabled) })}
        />
      ) : screen.name === "session" ? (
        <DailySessionScreen onFinish={() => setScreen({ name: homeScreenFor(japaneseModeEnabled) })} />
      ) : screen.name === "kana" ? (
        <KanaScreen onFinish={() => setScreen({ name: homeScreenFor(japaneseModeEnabled) })} />
      ) : screen.name === "dashboard" ? (
        <DashboardScreen
          onStartPractice={(payload) => setScreen({ name: "lesson", payload })}
          onStartGrammar={(payload) => setScreen({ name: "grammarDrill", payload })}
          onStartKanji={(payload) => setScreen({ name: "kanjiDrill", payload })}
          onStartKana={() => setScreen({ name: "kana" })}
          onStartListening={(payload) => setScreen({ name: "listeningDrill", payload })}
          onStartReading={(payload) => setScreen({ name: "readingDrill", payload })}
          onStartSession={() => setScreen({ name: "session" })}
          onGoToUpload={() => setScreen({ name: "upload" })}
        />
      ) : (
        <UploadConfigScreen onLessonReady={(payload) => setScreen({ name: "lesson", payload })} />
      )}
    </div>
  );
}

export function App() {
  return (
    <UiLanguageProvider>
      <FuriganaVisibilityProvider>
        <AppShell />
      </FuriganaVisibilityProvider>
    </UiLanguageProvider>
  );
}
