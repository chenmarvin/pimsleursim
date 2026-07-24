import type {
  ConversationRequest,
  ConversationResponse,
  ExtractRequest,
  ExtractResponse,
  GrammarDrillRequest,
  GrammarDrillResponse,
  KanjiDrillRequest,
  KanjiDrillResponse,
  LessonPlanRequest,
  LessonPlanResponse,
  ListeningDrillRequest,
  ListeningDrillResponse,
  N5GrammarContentRequest,
  N5GrammarContentResponse,
  N5KanjiContentRequest,
  N5KanjiContentResponse,
  N5VocabContentRequest,
  N5VocabContentResponse,
  QuizDrillRequest,
  QuizDrillResponse,
  ReadingDrillRequest,
  ReadingDrillResponse,
  ScenarioDrillRequest,
  ScenarioDrillResponse,
  ShadowingDrillRequest,
  ShadowingDrillResponse,
  TTSRequest,
  TTSResponse,
  WritingDrillRequest,
  WritingDrillResponse,
} from "@pimsleursim/shared";

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request to ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<TResponse>;
}

export function extractVocabulary(req: ExtractRequest): Promise<ExtractResponse> {
  return postJson<ExtractResponse>("/api/extract", req);
}

export function fetchNextLesson(req: LessonPlanRequest): Promise<LessonPlanResponse> {
  return postJson<LessonPlanResponse>("/api/lesson/next", req);
}

export function synthesizeSpeech(req: TTSRequest): Promise<TTSResponse> {
  return postJson<TTSResponse>("/api/tts", req);
}

export function generateConversation(req: ConversationRequest): Promise<ConversationResponse> {
  return postJson<ConversationResponse>("/api/conversation", req);
}

export function fetchGrammarDrill(req: GrammarDrillRequest): Promise<GrammarDrillResponse> {
  return postJson<GrammarDrillResponse>("/api/grammar/next", req);
}

export function fetchKanjiDrill(req: KanjiDrillRequest): Promise<KanjiDrillResponse> {
  return postJson<KanjiDrillResponse>("/api/kanji/next", req);
}

export function fetchListeningDrill(req: ListeningDrillRequest): Promise<ListeningDrillResponse> {
  return postJson<ListeningDrillResponse>("/api/listening/next", req);
}

export function fetchReadingDrill(req: ReadingDrillRequest): Promise<ReadingDrillResponse> {
  return postJson<ReadingDrillResponse>("/api/reading/next", req);
}

export function fetchQuiz(req: QuizDrillRequest): Promise<QuizDrillResponse> {
  return postJson<QuizDrillResponse>("/api/quiz/next", req);
}

export function fetchScenario(req: ScenarioDrillRequest): Promise<ScenarioDrillResponse> {
  return postJson<ScenarioDrillResponse>("/api/scenario/next", req);
}

export function fetchShadowingSet(req: ShadowingDrillRequest): Promise<ShadowingDrillResponse> {
  return postJson<ShadowingDrillResponse>("/api/shadowing/next", req);
}

export function fetchWritingSentences(req: WritingDrillRequest): Promise<WritingDrillResponse> {
  return postJson<WritingDrillResponse>("/api/writing/next", req);
}

export function fetchN5VocabContent(req: N5VocabContentRequest): Promise<N5VocabContentResponse> {
  return postJson<N5VocabContentResponse>("/api/n5-vocab/content", req);
}

export function fetchN5KanjiContent(req: N5KanjiContentRequest): Promise<N5KanjiContentResponse> {
  return postJson<N5KanjiContentResponse>("/api/kanji/n5-content", req);
}

export function fetchN5GrammarContent(req: N5GrammarContentRequest): Promise<N5GrammarContentResponse> {
  return postJson<N5GrammarContentResponse>("/api/grammar/n5-content", req);
}
