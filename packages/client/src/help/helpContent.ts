import type { UiLanguage } from "../i18n/strings.js";

export interface HelpParagraph {
  label?: string;
  text: string;
}

export interface HelpTopic {
  id: string;
  title: Record<UiLanguage, string>;
  paragraphs: Record<UiLanguage, HelpParagraph[]>;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "getting-started",
    title: { en: "Getting Started", "zh-TW": "新手上路" },
    paragraphs: {
      en: [
        {
          text: "This app has two modes, switched with the \"JLPT mode: On/Off\" button in the top bar.",
        },
        {
          label: "JLPT mode: Off",
          text: "You paste or upload your own practice material (any text, in any language) and the app builds vocabulary lessons from it.",
        },
        {
          label: "JLPT mode: On",
          text: "You follow a structured Japanese curriculum organized by JLPT level (N5 through N1), with a dashboard, daily sessions, and dedicated drills for kanji, grammar, reading, listening, speaking, scenarios, writing, and quizzes.",
        },
        {
          text: "You can switch between the two modes at any time — your saved vocabulary and progress are kept either way.",
        },
      ],
      "zh-TW": [
        {
          text: "本應用程式有兩種模式，可透過頂端列的「JLPT mode: On/Off」按鈕切換。",
        },
        {
          label: "JLPT mode: Off（關閉）",
          text: "你可以貼上或上傳自己的練習教材（任何語言的文字皆可），應用程式會依此建立詞彙課程。",
        },
        {
          label: "JLPT mode: On（開啟）",
          text: "你將依照 JLPT 級別（N5 到 N1）進行結構化的日語課程，並使用主控台、每日課程，以及漢字、文法、閱讀、聽力、口說、情境對話、寫作與測驗等專屬練習。",
        },
        {
          text: "你可以隨時切換這兩種模式——已儲存的詞彙與學習進度不會因此遺失。",
        },
      ],
    },
  },
  {
    id: "uploading-material",
    title: { en: "Uploading Your Own Material", "zh-TW": "上傳自訂教材" },
    paragraphs: {
      en: [
        {
          text: "Available when JLPT mode is off. Set your native language and target language using the two language-code fields (e.g. \"en\", \"zh-TW\", \"ja\").",
        },
        {
          text: "Then either paste text directly into the textarea, or use \"Choose File\" to load a .txt or .pdf file — the text is extracted automatically.",
        },
        {
          label: "Scanned pages",
          text: "If a PDF page has no selectable text (it's a scanned image), that page is skipped and listed in a warning — it won't contribute any vocabulary.",
        },
        {
          label: "Long text",
          text: "Very long input is truncated to a processed character limit; you'll see a notice with the processed/total counts and must click \"Continue anyway\" to proceed with the partial text.",
        },
        {
          text: "Clicking \"Start lesson\" sends the text to be analyzed for vocabulary (up to 60 items), merges any new words into your saved catalog, and starts a lesson introducing them.",
        },
      ],
      "zh-TW": [
        {
          text: "此功能僅在 JLPT mode 關閉時可用。請先在兩個語言代碼欄位中設定你的母語與目標語言（例如「en」、「zh-TW」、「ja」）。",
        },
        {
          text: "接著你可以直接將文字貼到文字框中，或點選「Choose File」上傳 .txt 或 .pdf 檔案——系統會自動擷取文字內容。",
        },
        {
          label: "掃描頁面",
          text: "如果 PDF 頁面沒有可選取的文字（屬於掃描影像），該頁會被略過並列在警告訊息中，不會產生任何詞彙。",
        },
        {
          label: "文字過長",
          text: "過長的內容會被截斷至可處理的字數上限；你會看到已處理／總字數的提示，必須點選「Continue anyway」才能以截斷後的內容繼續。",
        },
        {
          text: "點選「Start lesson」後，系統會分析文字以擷取詞彙（最多 60 個），將新詞彙併入你已儲存的詞庫，並開始一堂介紹這些詞彙的課程。",
        },
      ],
    },
  },
  {
    id: "dashboard-phases",
    title: { en: "Dashboard & JLPT Phases", "zh-TW": "主控台與 JLPT 級別" },
    paragraphs: {
      en: [
        {
          text: "The dashboard (JLPT mode on) shows your current phase (N5–N1), each phase's target vocab/kanji/grammar counts, and how many words are in your catalog vs. due for review today.",
        },
        {
          label: "Time budget",
          text: "Pick how many minutes you have today — this changes how the per-module time allocations are shown for that day's plan.",
        },
        {
          label: "Changing phase",
          text: "You can jump directly to any JLPT phase with the phase dropdown, or use \"Ready to move to N4\" (or whichever phase is next) once you've met the current phase's targets — this asks for confirmation before switching.",
        },
        {
          label: "Kana gate",
          text: "If you haven't finished the hiragana/katakana module yet, the Kanji module is locked and shows a hint to complete kana first.",
        },
      ],
      "zh-TW": [
        {
          text: "主控台（JLPT mode 開啟時）會顯示你目前的級別（N5–N1）、每個級別的詞彙／漢字／文法目標數量，以及你詞庫中的字數與今日待複習的字數。",
        },
        {
          label: "時間預算",
          text: "選擇你今天有多少練習時間——這會改變當天課程中各模組所分配的時間顯示。",
        },
        {
          label: "切換級別",
          text: "你可以用級別下拉選單直接跳到任一 JLPT 級別，或是在達成目前級別的目標後，使用「Ready to move to N4」（或下一個級別）按鈕——切換前會先詢問確認。",
        },
        {
          label: "假名關卡",
          text: "如果你尚未完成平假名／片假名練習，漢字模組會被鎖定，並顯示提示要求先完成假名練習。",
        },
      ],
    },
  },
  {
    id: "kana-gate",
    title: { en: "Hiragana & Katakana", "zh-TW": "平假名與片假名" },
    paragraphs: {
      en: [
        {
          text: "A one-time gate you complete before Kanji unlocks. It steps through every hiragana/katakana character one at a time, showing the character and its romaji.",
        },
        {
          text: "Use \"Repeat\" to hear the character spoken aloud, and \"Continue\" to move to the next one. A progress line shows how far through the set you are.",
        },
        {
          text: "On the last character the button finishes the module and marks kana as complete — after that, Kanji practice becomes available in the dashboard and in Daily Sessions.",
        },
      ],
      "zh-TW": [
        {
          text: "這是在漢字模組解鎖前，需要完成一次的關卡練習。系統會逐一顯示每個平假名／片假名字元及其羅馬拼音。",
        },
        {
          text: "使用「Repeat」聆聽字元發音，使用「Continue」前進到下一個字元。畫面上的進度列會顯示目前的練習進度。",
        },
        {
          text: "完成最後一個字元後，按鈕會結束此模組並將假名標記為完成——之後，漢字練習就會出現在主控台與每日課程中。",
        },
      ],
    },
  },
  {
    id: "n5-lesson-path",
    title: { en: "N5 Lesson Path", "zh-TW": "N5 課程路徑" },
    paragraphs: {
      en: [
        {
          text: "While your phase is N5, the dashboard's main button starts a separate, numbered lesson path (Lesson 1 of 40, etc.) instead of the general Daily Session.",
        },
        {
          text: "Each lesson shows a theme and objectives, then chains: vocabulary → new kanji (one screen each) → a kanji check quiz → new grammar points → reading → listening → speaking → writing → quiz.",
        },
        {
          label: "Review lessons",
          text: "Every 4th lesson is automatically a cumulative review (\"Reviewing Lessons X–Y\") — it skips new kanji/grammar and instead re-drills earlier material.",
        },
        {
          text: "Each lesson ends with a wrap-up: a checklist of what you covered, your objectives checked off, and any Chinese-speaker notes gathered from that lesson's vocab/kanji/grammar.",
        },
        {
          text: "Once all 40 lessons are done, the dashboard shows \"N5 curriculum complete\" — advancing to N4 switches you over to the general Daily Session flow instead.",
        },
      ],
      "zh-TW": [
        {
          text: "當你的級別為 N5 時，主控台的主要按鈕會啟動一個獨立、按編號進行的課程路徑（第 1 課／共 40 課，以此類推），而非一般的每日課程。",
        },
        {
          text: "每一課會先顯示主題與學習目標，接著依序進行：詞彙 → 新漢字（每字一個畫面）→ 漢字檢測測驗 → 新文法 → 閱讀 → 聽力 → 口說 → 寫作 → 測驗。",
        },
        {
          label: "複習課",
          text: "每第 4 課會自動變成累積複習課（顯示「Reviewing Lessons X–Y」）——不會教新的漢字或文法，而是重新練習先前教過的內容。",
        },
        {
          text: "每一課結束時會有總結畫面：列出本課涵蓋的內容、勾選已達成的學習目標，以及本課詞彙／漢字／文法中收錄的中文使用者提醒。",
        },
        {
          text: "完成全部 40 課後，主控台會顯示「N5 curriculum complete」——進入 N4 後，會改為使用一般的每日課程流程。",
        },
      ],
    },
  },
  {
    id: "daily-session",
    title: { en: "Daily Session (N4–N1)", "zh-TW": "每日課程（N4–N1）" },
    paragraphs: {
      en: [
        {
          text: "Once you're past N5, \"Start full session\" on the dashboard runs a single chained flow: Vocabulary → Kanji → Grammar → Reading → Listening → Speaking (Shadowing) → Scenario Practice → Writing → Quiz.",
        },
        {
          text: "The intro screen lists that day's objectives; each step finishes with a \"Continue\" that loads the next one automatically, and a final outcomes screen checklists everything you completed.",
        },
        {
          label: "Review sessions",
          text: "Every 5th completed session is automatically a review session (\"Review session (no new material)\") — Kanji and Grammar are skipped, and vocabulary introduces zero new items, while reading/listening/speaking/scenario/writing/quiz still run normally.",
        },
      ],
      "zh-TW": [
        {
          text: "當你的級別超過 N5 後，主控台的「Start full session」會依序執行一整套流程：詞彙 → 漢字 → 文法 → 閱讀 → 聽力 → 口說（Shadowing）→ 情境對話練習 → 寫作 → 測驗。",
        },
        {
          text: "開始畫面會列出當天的學習目標；每個步驟結束後點選「Continue」即可自動載入下一個步驟，最後的成果畫面會列出你完成的所有項目。",
        },
        {
          label: "複習課程",
          text: "每完成第 5 次課程會自動變成複習課程（顯示「Review session (no new material)」）——會略過漢字與文法，詞彙也不會介紹新項目，但閱讀／聽力／口說／情境對話／寫作／測驗仍會正常進行。",
        },
      ],
    },
  },
  {
    id: "practice-modules",
    title: { en: "Practice Modules", "zh-TW": "練習模組" },
    paragraphs: {
      en: [
        {
          label: "Vocabulary",
          text: "New words are introduced one at a time, then recalled with \"How do you say: [phrase]?\" prompts — type your answer, and alternate accepted readings are shown alongside the correct one.",
        },
        {
          label: "Grammar",
          text: "Shows a pattern's explanation, structure, common mistakes, and a Chinese-speaker note, plays an example sentence, then asks you to translate further example sentences by typing — with audio and Correct/Not quite feedback.",
        },
        {
          label: "Kanji",
          text: "Shows one character with its meaning, readings, example words and sentence, a stroke-order tip, and a self-check list of words using it, each hidden behind a \"Reveal answer\" button.",
        },
        {
          label: "Reading",
          text: "A passage with furigana and a \"Read aloud\" button, a show/hide translation toggle, and comprehension questions revealed on demand.",
        },
        {
          label: "Listening",
          text: "\"Play all\" reads the dialogue once slowly, then once at natural speed; each line shows furigana and translation, followed by reveal-on-demand comprehension questions.",
        },
        {
          label: "Speaking (Shadowing)",
          text: "Repeats short sentences 3x aloud for you to mimic; you can hide the text to force yourself to recall it from memory before checking.",
        },
        {
          label: "Scenario Practice",
          text: "A short role-play scene (e.g. ordering food, asking directions) where you must produce a response before seeing the answer. Listening mode: think of your reply, then reveal it and hear it played aloud (self-assessed, no typing needed). Writing mode: type your reply and get it automatically graded against the model answer. Available both as standalone dashboard buttons and as a step within the Daily Session.",
        },
        {
          label: "Writing",
          text: "Trace recent kanji by stroke order on a canvas, then translate sentences by typing, with Correct/Not quite feedback and the model answer shown.",
        },
        {
          label: "Quiz",
          text: "Mixes multiple-choice, typed-answer, and listening questions across vocab/grammar/reading/kanji, ending with a score summary.",
        },
      ],
      "zh-TW": [
        {
          label: "詞彙",
          text: "新單字會逐一介紹，之後透過「How do you say: [片語]?」的提示進行回想練習——輸入你的答案，畫面會同時顯示正確答案與其他可接受的說法。",
        },
        {
          label: "文法",
          text: "顯示文法句型的說明、結構、常見錯誤，以及中文使用者提醒，並播放例句發音，接著請你輸入其他例句的翻譯——附有發音與「Correct / Not quite」回饋。",
        },
        {
          label: "漢字",
          text: "顯示一個漢字及其字義、讀音、例詞與例句、筆順提示，以及使用該漢字之單字的自我檢測清單，每個答案需點選「Reveal answer」才會顯示。",
        },
        {
          label: "閱讀",
          text: "顯示一篇附有furigana（讀音標註）的文章與「Read aloud」朗讀按鈕、翻譯顯示／隱藏切換，以及可依需求顯示答案的理解問題。",
        },
        {
          label: "聽力",
          text: "「Play all」會先以慢速播放整段對話一次，再以正常速度播放一次；每句對話都附有讀音標註與翻譯，之後是可依需求顯示答案的理解問題。",
        },
        {
          label: "口說（Shadowing）",
          text: "將簡短句子重複播放三次讓你跟讀；你也可以隱藏文字，強迫自己憑記憶跟讀後再檢查。",
        },
        {
          label: "情境對話練習",
          text: "一段簡短的情境對話（例如點餐、問路），你必須先想出自己的回應，才能看到答案。聽力模式：先想好回應，再點擊揭曉並聆聽正確回應的發音（自我評估，不需輸入文字）。寫作模式：輸入你的回應，系統會自動與參考答案比對評分。此練習可從主控台的獨立按鈕啟動，也會出現在每日課程的其中一個步驟中。",
        },
        {
          label: "寫作",
          text: "先在畫布上依筆順描摹最近學過的漢字，接著輸入句子翻譯，並提供「Correct / Not quite」回饋與參考答案。",
        },
        {
          label: "測驗",
          text: "混合選擇題、輸入題與聽力題，涵蓋詞彙／文法／閱讀／漢字，結束後顯示分數總結。",
        },
      ],
    },
  },
  {
    id: "settings-display",
    title: { en: "Settings & Display", "zh-TW": "設定與顯示" },
    paragraphs: {
      en: [
        {
          label: "Font size",
          text: "The \"A−\" / \"A+\" buttons in the top bar make all text on the page smaller or larger.",
        },
        {
          label: "Furigana",
          text: "Toggles whether hiragana readings are shown above kanji throughout the app.",
        },
        {
          label: "Interface language",
          text: "The language switcher on the right changes the app's own interface language (English / 繁體中文) — this is separate from the target language you're learning (e.g. Japanese), which is set elsewhere (upload screen, or fixed to Japanese in JLPT mode).",
        },
      ],
      "zh-TW": [
        {
          label: "字體大小",
          text: "頂端列的「A−」／「A+」按鈕可以縮小或放大頁面上的所有文字。",
        },
        {
          label: "Furigana（讀音標註）",
          text: "切換是否在漢字上方顯示平假名讀音標註，適用於整個應用程式。",
        },
        {
          label: "介面語言",
          text: "右側的語言切換按鈕會變更應用程式本身的介面語言（English／繁體中文）——這與你正在學習的目標語言（例如日文）是分開設定的，目標語言會在其他地方設定（上傳畫面，或在 JLPT mode 中固定為日文）。",
        },
      ],
    },
  },
];
