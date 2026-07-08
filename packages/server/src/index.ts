import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { config } from "./config.js";
import { conversationRouter } from "./routes/conversation.js";
import { extractRouter } from "./routes/extract.js";
import { grammarRouter } from "./routes/grammar.js";
import { kanjiRouter } from "./routes/kanji.js";
import { lessonRouter } from "./routes/lesson.js";
import { listeningRouter } from "./routes/listening.js";
import { n5VocabRouter } from "./routes/n5Vocab.js";
import { quizRouter } from "./routes/quiz.js";
import { readingRouter } from "./routes/reading.js";
import { shadowingRouter } from "./routes/shadowing.js";
import { ttsRouter } from "./routes/tts.js";
import { writingRouter } from "./routes/writing.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/api/extract", extractRouter);
app.use("/api/lesson", lessonRouter);
app.use("/api/tts", ttsRouter);
app.use("/api/conversation", conversationRouter);
app.use("/api/grammar", grammarRouter);
app.use("/api/kanji", kanjiRouter);
app.use("/api/listening", listeningRouter);
app.use("/api/n5-vocab", n5VocabRouter);
app.use("/api/reading", readingRouter);
app.use("/api/quiz", quizRouter);
app.use("/api/shadowing", shadowingRouter);
app.use("/api/writing", writingRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// If the client has been built (`npm run build`), serve it from this same
// process/port instead of requiring a separate Vite dev server — this is
// what lets the whole app run as a single `node`/`tsx` process (e.g. on a
// phone via Termux, or any host where running Vite's esbuild-based dev
// server isn't desirable).
const clientDistDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDistDir, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "invalid_request", details: err.issues });
    return;
  }
  const message = err instanceof Error ? err.message : "Unknown server error";
  console.error(err);
  res.status(500).json({ error: "internal_error", message });
});

app.listen(config.port, () => {
  console.log(`pimsleursim server listening on http://localhost:${config.port}`);
});
