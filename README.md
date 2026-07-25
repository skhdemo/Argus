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

Next.js (App Router) · TypeScript · Tailwind · Web Speech API · `@google/genai` (Gemini 3+) · `react-force-graph-2d` · Vercel

## Setup (after scaffold lands)

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY (BE1)
npm run dev
```

Use **Chrome**. Allow microphone.

## Branching

Work on `fe/*`, `be1/*`, or `be2/*`. Integrate via PR → `develop`. Ship demo from `main`.

See Implementation Plan for file ownership — **do not cross streams**.
