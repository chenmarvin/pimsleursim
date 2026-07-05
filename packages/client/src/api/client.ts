import type {
  ConversationRequest,
  ConversationResponse,
  ExtractRequest,
  ExtractResponse,
  LessonPlanRequest,
  LessonPlanResponse,
  TTSRequest,
  TTSResponse,
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
