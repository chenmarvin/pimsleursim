import { UI_LANGUAGES } from "../i18n/strings.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";

export function LanguageSwitcher() {
  const { uiLanguage, setUiLanguage, t } = useUiLanguage();

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", alignItems: "center" }}>
      <span style={{ fontSize: "1rem" }}>{t("uiLanguageLabel")}</span>
      {UI_LANGUAGES.map(({ code, label }) => (
        <button key={code} onClick={() => setUiLanguage(code)} disabled={uiLanguage === code}>
          {label}
        </button>
      ))}
    </div>
  );
}
