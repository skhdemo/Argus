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

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Web Speech API · `@google/genai` (Gemini 3+) · `react-force-graph-2d` · Vercel

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Use **Chrome**. Allow microphone — speech capture is Web Speech API and Chrome-only.

Once BE1 lands `.env.example` (Task A0.2), also run `cp .env.example .env.local` and add
`GEMINI_API_KEY`. The frontend does not need it until it starts calling `/api/extract`.

> Tailwind v4 has no `tailwind.config.ts` — design tokens live in
> [`app/globals.css`](./app/globals.css) under `@theme`.

## Branching

Work on `fe/*`, `be1/*`, or `be2/*`. Integrate via PR → `develop`. Ship demo from `main`.

See Implementation Plan for file ownership — **do not cross streams**.
