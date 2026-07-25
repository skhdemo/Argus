# Argus

Live debate → Gemini structured extraction → real-time argument graph.

Hackathon demo. Desktop Chrome. No auth. No persistence. No manual speaker toggle.

## Docs (source of truth)

| Doc | Purpose |
|---|---|
| [`docs/PRD.md`](./docs/PRD.md) | Product scope & MoSCoW |
| [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) | Epics → phases → tasks → steps with owners |
| [`docs/TEAM.md`](./docs/TEAM.md) | Roles, branches, gates cheat sheet |
| [`.agents/README.md`](./.agents/README.md) | How personal agent briefs work (gitignored files) |

## Team

- **FE** — frontend only  
- **BE1** — extraction API / Gemini / contracts  
- **BE2** — speaker inference + Should Have APIs + advanced FE  

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
3. **Never commit** `.env.local` or real keys. Only BE1 / whoever rotates the shared demo key should hold Production secrets.
4. To rotate: generate a new key in AI Studio, update `.env.local` locally (and Vercel env later), revoke the old key.

Required for `/api/transcribe`, `/api/extract`, and `/api/summary` (all server-side).

> **Vercel:** project + Production/Preview `GEMINI_API_KEY` wiring is postponed — do it before demo deploy if time allows.

> Tailwind v4 has no `tailwind.config.ts` — design tokens live in
> [`app/globals.css`](./app/globals.css) under `@theme`.

## Branching

Work on `fe/*`, `be1/*`, or `be2/*`. Integrate via PR → `develop`. Ship demo from `main`.

See Implementation Plan for file ownership — **do not cross streams**.
