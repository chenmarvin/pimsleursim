export type UiLanguage = "en" | "zh-TW";

export const UI_LANGUAGES: { code: UiLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh-TW", label: "繁體中文" },
];

const en = {
  appTitle: "Pimsleursim",
  uiLanguageLabel: "Interface language:",
  appTagline: "Paste practice material in your target language, pick your languages, and start a lesson.",
  nativeLanguageLabel: "Native language (BCP-47, e.g. en, zh-TW):",
  targetLanguageLabel: "Target language (BCP-47, e.g. ja, es):",
  loadTextFileLabel: "Load a text file:",
  loadedFile: 'Loaded "{{fileName}}".',
  textareaPlaceholder:
    "Paste an article, dialogue, or vocab list in the target language, or load a text file above...",
  startLesson: "Start lesson",
  preparingLesson: "Preparing lesson...",
  errorPasteFirst: "Paste some practice text first.",
  errorFileRead: 'Couldn\'t read "{{fileName}}" as text.',
  errorGeneric: "Something went wrong.",
  lessonComplete: "Lesson complete",
  newItemsIntroduced: "New items introduced: {{count}}",
  reviewsCompleted: "Reviews completed: {{count}}",
  accuracy: "Accuracy: {{percent}}%",
  backToUpload: "Back to upload",
  stepProgress: "Step {{current}} / {{total}}",
  introducing: "Introducing: {{phrase}}",
  howDoYouSay: 'How do you say: "{{phrase}}"?',
  submit: "Submit",
  correct: "Correct!",
  notQuite: "Not quite.",
  correctAnswer: "Correct answer:",
  practiceWritingLabel: "Practice writing it:",
  continueLabel: "Continue",
};

const zhTW: typeof en = {
  appTitle: "Pimsleursim",
  uiLanguageLabel: "介面語言：",
  appTagline: "貼上目標語言的練習文本，選擇你的語言，然後開始上課。",
  nativeLanguageLabel: "母語（BCP-47，例如 en、zh-TW）：",
  targetLanguageLabel: "目標語言（BCP-47，例如 ja、es）：",
  loadTextFileLabel: "載入文字檔：",
  loadedFile: "已載入「{{fileName}}」。",
  textareaPlaceholder: "貼上目標語言的文章、對話或單字表，或在上方載入文字檔...",
  startLesson: "開始上課",
  preparingLesson: "課程準備中...",
  errorPasteFirst: "請先貼上練習文本。",
  errorFileRead: "無法將「{{fileName}}」讀取為文字檔。",
  errorGeneric: "發生錯誤。",
  lessonComplete: "課程完成",
  newItemsIntroduced: "新學項目：{{count}}",
  reviewsCompleted: "已複習：{{count}}",
  accuracy: "正確率：{{percent}}%",
  backToUpload: "返回上傳頁面",
  stepProgress: "步驟 {{current}} / {{total}}",
  introducing: "正在介紹：{{phrase}}",
  howDoYouSay: "「{{phrase}}」怎麼說？",
  submit: "送出",
  correct: "答對了！",
  notQuite: "不太對。",
  correctAnswer: "正確答案：",
  practiceWritingLabel: "練習寫一次：",
  continueLabel: "繼續",
};

export const STRINGS: Record<UiLanguage, typeof en> = { en, "zh-TW": zhTW };

export type StringKey = keyof typeof en;
