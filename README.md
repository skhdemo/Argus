# Argus

Live debate → Gemini structured extraction → real-time **claim–evidence** graph.

Claims are graph nodes; speaker-provided evidence is attached and optionally corroborated via Google Search. Hackathon demo. Desktop Chrome. No auth. No persistence. No manual speaker toggle.

## Docs (source of truth)

| Doc | Purpose |
|---|---|
| [`docs/PRD.md`](./docs/PRD.md) | Product scope & MoSCoW |
| [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) | Epics → phases → tasks → steps with owners |
| [`docs/FRONTEND_HANDOFF.md`](./docs/FRONTEND_HANDOFF.md) | **FE migration bible** for claim–evidence v2 (branch `be1/claim-evidence-v2`) |
| [`docs/DEBATE_SCORING.md`](./docs/DEBATE_SCORING.md) | Structural who-is-ahead formula + proofs |
| [`docs/TEAM.md`](./docs/TEAM.md) | Roles, branches, gates cheat sheet |
| [`.agents/README.md`](./.agents/README.md) | How personal agent briefs work (gitignored files) |

## Team

- **FE** — frontend only (graph shell, inspector, session hooks, pages)
- **Backend (full)** — former BE1 + BE2 under one owner: all `app/api/*`, extract / verify / score / summary / speaker / fallacy / debate libs + contracts

## API overview

| Endpoint | Role |
|---|---|
| `POST /api/transcribe` | Gemini audio STT + diarization |
| `POST /api/extract` | Claims + attached Evidence + Relations (deltas) |
| `POST /api/verify-evidence` | Async Google Search corroboration (not on extract hot path) |
| `POST /api/score` | Deterministic debate score (`scoreA`/`scoreB`) — no API key |
| `POST /api/summary` | Stats + narrative + embedded `debateScore` |

Breaking v2 contract lives on `be1/claim-evidence-v2`. FE must integrate via [`docs/FRONTEND_HANDOFF.md`](./docs/FRONTEND_HANDOFF.md) before merge to `develop`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · MediaRecorder + Gemini audio STT/diarization · `@google/genai` (Gemini 3+) · `react-force-graph-2d` · Vercel

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open http://localhost:3000.

Use a desktop browser with mic support (**Chrome** recommended). Allow microphone — audio is recorded in short chunks and transcribed by **Gemini** (`POST /api/transcribe`), including speaker A/B diarization.

### Gemini API key

1. Create a key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Put it in `.env.local` as `GEMINI_API_KEY=...` (see [`.env.example`](./.env.example)).
3. **Never commit** `.env.local` or real keys. Only Backend / whoever rotates the shared demo key should hold Production secrets.
4. To rotate: generate a new key in AI Studio, update `.env.local` locally (and Vercel env later), revoke the old key.

Required for `/api/transcribe`, `/api/extract`, `/api/verify-evidence`, and `/api/summary` (all server-side). `/api/score` needs no key.

### Verify env vars

See [`.env.example`](./.env.example):

- `ARGUS_VERIFY_ENABLED` — default enabled unless `false`
- `ARGUS_VERIFY_CONCURRENCY` — in-process concurrency (default `1`; FE must also serialize)
- `GEMINI_VERIFY_MODEL` — optional override

> **Vercel:** project + Production/Preview `GEMINI_API_KEY` (and verify vars) wiring is postponed — do it before demo deploy if time allows.

> Tailwind v4 has no `tailwind.config.ts` — design tokens live in
> [`app/globals.css`](./app/globals.css) under `@theme`.

## Backend scripts

```bash
npm run test:backend
npm run typecheck:backend
```

## Branching

Work on `fe/*` or `be1/*` (Backend). Integrate via PR → `develop`. Ship demo from `main`.

**Claim–evidence v2:** branch `be1/claim-evidence-v2` — do not merge to `develop` until FE adopts [`docs/FRONTEND_HANDOFF.md`](./docs/FRONTEND_HANDOFF.md).

See Implementation Plan for file ownership — **do not cross streams**.
