import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { STRINGS, type StringKey, type UiLanguage } from "./strings.js";

const UI_LANGUAGE_KEY = "pimsleursim.uiLanguage.v1";

function loadStoredUiLanguage(): UiLanguage {
  return localStorage.getItem(UI_LANGUAGE_KEY) === "zh-TW" ? "zh-TW" : "en";
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(params[key] ?? ""));
}

interface UiLanguageContextValue {
  uiLanguage: UiLanguage;
  setUiLanguage: (lang: UiLanguage) => void;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
}

const UiLanguageContext = createContext<UiLanguageContextValue | null>(null);

export function UiLanguageProvider({ children }: { children: ReactNode }) {
  const [uiLanguage, setUiLanguageState] = useState<UiLanguage>(loadStoredUiLanguage);

  function setUiLanguage(lang: UiLanguage) {
    setUiLanguageState(lang);
    localStorage.setItem(UI_LANGUAGE_KEY, lang);
  }

  const t = useMemo(() => {
    const dict = STRINGS[uiLanguage];
    return (key: StringKey, params?: Record<string, string | number>) => interpolate(dict[key], params);
  }, [uiLanguage]);

  const value = useMemo(() => ({ uiLanguage, t, setUiLanguage }), [uiLanguage, t]);

  return <UiLanguageContext.Provider value={value}>{children}</UiLanguageContext.Provider>;
}

export function useUiLanguage(): UiLanguageContextValue {
  const ctx = useContext(UiLanguageContext);
  if (!ctx) throw new Error("useUiLanguage must be used within a UiLanguageProvider");
  return ctx;
}
