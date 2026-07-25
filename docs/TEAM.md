# Argus — Team & branching quick reference

Full plan: [`docs/IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) · Product: [`docs/PRD.md`](./PRD.md)

## Roles (assign names in Discord)

| Code | Who | Domain |
|---|---|---|
| **FE** | Frontend only | Speech UI, graph shell, inspector, session hooks, `page.tsx` |
| **BE1** | Backend extract | Gemini client, `/api/extract`, contracts, fixtures, Vercel env |
| **BE2** | Backend infer + advanced FE | Speaker inference, summary, fallacies, SummaryPanel/badges/animations |

Personal checklists: gitignored `.agents/FE.agent.md`, `BE1.agent.md`, `BE2.agent.md` (see `.agents/README.md`).

## Branches

```
main      ← demo production only
develop   ← integrate here

fe/*      FE only
be1/*     BE1 only
be2/*     BE2 only
chore/*   one owner announced in Discord
contract/*  type/API shape — all three ack
```

## Golden rules

1. **Don't touch files you don't own** (matrix in Implementation Plan §2).
2. **BE2 never edits `app/page.tsx`** — FE mounts components.
3. **BE1 owns `lib/types/debate.ts`** — additive changes only after freeze.
4. **BE2's route wire-up** = tiny PR; BE1 merges.
5. **No manual speaker toggle** — ever.
6. Agent MDs stay local/Discord — not in git history as shared truth.

## Phase gates (shortest path to demo)

| Gate | Meaning |
|---|---|
| A0 | App boots + types + Vercel project |
| B1 | Mic → transcript |
| B2 | `/api/extract` returns JSON |
| B3 | Speaker fields on responses |
| B4 | Full Must vertical slice |
| B5 | Production Must |
| C | Should Haves (summary/fallback/confidence minimum) |
| D | Rehearsal hardened |

## First day

1. Name → role in Discord.  
2. Each person keeps their `.agents/*.agent.md` locally.  
3. FE: Task A0.1 scaffold.  
4. BE1: A0.2 + A0.3 after scaffold.  
5. BE2: read docs; draft speaker approach in `#argus-be`.
