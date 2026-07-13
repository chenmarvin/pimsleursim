# Development Progress

Living record of design decisions and what has shipped, session by session. Update this file (not just chat memory) whenever a session ends with a decision made or a feature shipped, so the history survives outside any single Claude conversation.

## 1. Project scope

pimsleursim simulates the Pimsleur language-learning method (graduated interval recall, anticipation method, spaced review) as an interactive local web app:

- **Input**: raw/unstructured text in the target language — the app extracts teachable vocab/phrases itself, no pre-structured lists assumed. PDF upload is also supported, but native-text PDFs only (client-side `pdfjs-dist`); scanned pages get a warning, no OCR.
- **Language pair**: fully general (any source/target BCP-47 pair), not hardcoded.
- **Output**: plays TTS audio, captures the learner's typed response, drives the loop live in-browser.
- **Persistence**: no backend DB — all learner state (mastery, session/lesson progress, kana/kanji/grammar coverage) lives in browser `localStorage`, single-user local app.

Added later as an add-on (not a replacement): a **Japanese/JLPT study mode** with a bundled N5→N1 curriculum, grammar/reading/listening drills, and a daily-schedule dashboard, built for the user's own JLPT study.

## 2. Architecture

npm-workspaces monorepo:

- `packages/shared` — GIR (graduated-interval-recall) scheduler + shared types, used by both client and server so scheduling logic isn't duplicated. Also holds `n5Syllabus.ts` (ground-truth vocab/kanji/grammar seed data per N5 lesson).
- `packages/server` — Node/Express/TS. `routes/` + `services/` (including `services/tts/`). LLM extraction/generation via the Anthropic Claude API using `client.messages.parse()` + `zodOutputFormat()` for structured JSON; model id from `CLAUDE_MODEL` env var.
- `packages/client` — React/Vite/TS. Key subfolders: `screens/` (one per app flow — upload, lesson player, JLPT dashboard, kana/kanji/grammar drills, etc.), `storage/` (localStorage-backed progress stores), `audio/` (TTS playback incl. browser `speechSynthesis` fallback), `i18n/` (EN / Traditional Chinese UI strings), `evaluation/` (typed-answer fuzzy matching), `japanese/` (curriculum/furigana helpers), `files/` (PDF text extraction), `api/`, `components/`.

Pluggable interfaces by design: `ResponseEvaluator` (typed-answer fuzzy match today, room for STT later) and `TTSProvider` (cloud TTS preferred when configured, browser `speechSynthesis` fallback otherwise).

Content architecture note: N5 lesson **content** is authored once, upfront, as static files at `content/n5/lesson-01.md` … `lesson-40.md` (YAML frontmatter with `lesson`/`isReview`/`theme`) rather than generated per-learner at runtime. `n5Syllabus.ts` remains the seed data for vocab/kanji/grammar items; the older on-demand generation path through it is legacy relative to this decision. If N4–N1 content is added later, follow the same `content/n4/`, etc. pattern.

## 3. Feature status (as of 2026-07-09)

| Feature | Status |
|---|---|
| Raw-text vocab/phrase extraction (any language pair) | Shipped |
| Pimsleur-style spaced lesson playback (anticipate → typed answer → grade → reveal → retest re-splice) | Shipped |
| Cloud TTS + browser `speechSynthesis` fallback | Shipped |
| Bilingual UI (English / 繁體中文) | Shipped |
| PDF upload (native-text only) | Shipped |
| On-demand conversation generation from the learner's vocab catalog | Shipped |
| Japanese/JLPT add-on mode: daily dashboard, grammar drills, kana/kanji drills, furigana toggle | Shipped |
| N5 fixed 40-lesson syllabus content | 40/40 lessons authored (`lesson-25.md` gap filled 2026-07-09) |
| N4–N1 fixed-syllabus content | Not started |
| Cross-session learner progress persistence (session count, N5 lesson position, kana/kanji/grammar coverage, vocab mastery) | Verified working via `localStorage` stores — audited 2026-07-09, no gaps found |
| OCR / scanned-PDF support | Not started (explicitly out of scope unless requirements change) |
| On-device Termux (Android) run path | Documented/recommended, not yet verified on a real device |

## 4. Known issues / open items

- Termux/Android on-device run path (build client on PC, transfer `packages/server` + `packages/shared` + `packages/client/dist` + `.env`, `npm run start` on-device) is our best-designed recommendation but has not been verified on a real device yet.
- Upload-material source recommendations (NHK Easy News for N5, manga transcripts for N4, NHK News/novels for N3+, eventually the user's medical-device regulatory docs for N2+) were given conversationally but never built into the app as a curated source list.
- The same stale-language error pattern just fixed in `UploadConfigScreen` (see 2026-07-13 log entry) also exists in `DashboardScreen.tsx`, `N5LessonScreen.tsx`, `ConversationView.tsx`, and `DailySessionScreen.tsx` — each stores `err.message` or a `t()`-resolved string in state instead of an i18n key, so a displayed error won't retranslate on a language switch. Not fixed yet; noted but out of scope for the session that fixed `UploadConfigScreen`.

## 5. Session log

- **2026-07-02** — v1 scaffold built and live-tested end-to-end (extraction → scheduling → browser interaction loop) with a real Claude API key. Two real bugs found only by driving the browser UI (not caught by typecheck): a React 18 StrictMode double-mount issue stalling the lesson at step 1, and a `queue` effect dependency clobbering the reveal UI during retest splicing. App made runnable as a single Node process (server serves the built static client) for portability.
- **2026-07-03** — Added browser TTS fallback (`speechSynthesis`) and bilingual EN/繁體中文 UI. Fixed `.env` resolution bug (was cwd-relative, silently failing under `npm run start --workspace=...`). Converted from manual rsync to a real git repo tracking `chenmarvin/pimsleursim` on GitHub; reconciled with 3 commits already on GitHub (multi-script Japanese answer support, `kanaReading` field, adjustable font-size control).
- **2026-07-07** — Japanese/JLPT study mode added as a scoped add-on (confirmed via clarifying question): daily-schedule dashboard, grammar drills, PDF vocab upload, on-demand conversation generation, furigana (`<ruby>/<rt>`) rendering shipped across vocab/dialogue/grammar. Paused mid-discussion on upload-material sourcing.
- **2026-07-08** — Decided N5 (and by extension N4–N1) content should be a fixed, pre-authored syllabus rather than generated on-demand at runtime. Authored all 40 N5 lesson content files to `content/n5/` per `docs/jlpt-course-requirements.md` (REQ-1 through REQ-24). Fixed the N5 kanji list to match real JLPT N5 references.
- **2026-07-09** — Audited and confirmed cross-session learner progress persistence already works correctly end-to-end via `localStorage` stores (no code changes needed). Created this progress log, which noted a `lesson-25.md` gap in the N5 syllabus. Authored `content/n5/lesson-25.md` (review lesson covering Lessons 21–24: daily schedule, lending/borrowing, feelings/opinions, nature/animals) to close the gap — all 40 N5 lessons are now present.
- **2026-07-13** — Installed and authenticated the GitHub CLI (`gh`) for this environment (see §6) and switched to a feature-branch + PR workflow for new changes. Fixed the `UploadConfigScreen` stale-language error bug listed in §4: errors were stored as already-resolved translated strings, so a displayed error didn't retranslate on a UI language switch; now stored as an i18n key (+ params) and resolved via `t()` at render time. Verified live by driving the app with a headless-Chromium (Playwright) script against the Vite dev server: triggered the English error, switched to 繁體中文 mid-display, confirmed the DOM text updated to the Chinese string with no stale English left and no console errors. Shipped via PR #5 (`claude/fix-error-retranslation`), squash-merged to `master`. While fixing this, found the same pattern (resolved string instead of i18n key) recurs in four other screens/components — logged as a new §4 open item rather than fixed in this pass.

## 6. Operational notes

- The user has two GitHub accounts; a `GH_TOKEN` env var shadows the personal account (`chenmarvin`, this repo's owner) with the work account (`GSHMarvin`). `unset GH_TOKEN` before any `git pull`/`push` against this repo.
- `gh` (GitHub CLI) is installed and authenticated as `chenmarvin` over HTTPS, with git's credential helper wired to it (`gh auth setup-git`). New changes should go through a feature branch + `gh pr create` rather than committing straight to `master` (see 2026-07-13 log entry — the earlier extraction max_tokens commit went straight to `master` with no PR, which this workflow now avoids).
- Real sample practice material (`pim01_time.txt`, `pim02_personlife.txt`, `pim03_basicverbs.txt`) lives at the repo root as genuine test input for the extraction step — intentionally messy/inconsistent formatting. Do not overwrite.
