import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { config } from "./config.js";
import { extractRouter } from "./routes/extract.js";
import { lessonRouter } from "./routes/lesson.js";
import { ttsRouter } from "./routes/tts.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/api/extract", extractRouter);
app.use("/api/lesson", lessonRouter);
app.use("/api/tts", ttsRouter);

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
