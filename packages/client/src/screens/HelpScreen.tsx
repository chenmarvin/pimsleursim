import { useState } from "react";
import { HELP_TOPICS } from "../help/helpContent.js";
import { useUiLanguage } from "../i18n/useUiLanguage.js";

interface Props {
  onFinish: () => void;
}

export function HelpScreen({ onFinish }: Props) {
  const { t, uiLanguage } = useUiLanguage();
  const [topicId, setTopicId] = useState<string | null>(null);

  const topic = HELP_TOPICS.find((candidate) => candidate.id === topicId) ?? null;

  if (!topic) {
    return (
      <div>
        <h2>{t("helpScreenTitle")}</h2>
        <ul>
          {HELP_TOPICS.map((candidate) => (
            <li key={candidate.id}>
              <button onClick={() => setTopicId(candidate.id)}>{candidate.title[uiLanguage]}</button>
            </li>
          ))}
        </ul>
        <button onClick={onFinish}>{t("helpClose")}</button>
      </div>
    );
  }

  return (
    <div>
      <h2>{topic.title[uiLanguage]}</h2>
      {topic.paragraphs[uiLanguage].map((p, i) => (
        <p key={i}>
          {p.label && <strong>{p.label}: </strong>}
          {p.text}
        </p>
      ))}
      <button onClick={() => setTopicId(null)}>{t("helpBackToTopics")}</button>{" "}
      <button onClick={onFinish}>{t("helpClose")}</button>
    </div>
  );
}
