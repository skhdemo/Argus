# Argus — Team & branching quick reference

Full plan: [`docs/IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) · Product: [`docs/PRD.md`](./PRD.md) · FE v2 handoff: [`docs/FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md)

## Roles (assign names in Discord)

| Code | Who | Domain |
|---|---|---|
| **FE** | Frontend only | Speech UI, claim-only graph shell, inspector (attached evidence), session hooks, `page.tsx` |
| **Backend** | Full backend (former **BE1 + BE2**) | All `app/api/*`, `lib/extract`, `lib/verify`, `lib/score`, `lib/summary`, `lib/fallacy`, `lib/speaker`, `lib/debate`, `lib/types/debate.ts`, fixtures, env |

Personal checklists: gitignored `.agents/*.agent.md` (see `.agents/README.md`). Historical `BE1.agent.md` / `BE2.agent.md` templates may still exist — Backend owns both scopes.

## Claim–evidence v2

- **Breaking contract** on branch `be1/claim-evidence-v2` (not yet merged to `develop`).
- Ontology: Claims = only graph nodes; Evidence attached (never nodes); Relations = `counters` \| `responds_to`.
- **FE adoption gate:** integrate via [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md) **before** merging v2 to `develop`.

## Branches

```
main      ← demo production only
develop   ← integrate here (after FE handoff for v2)

fe/*      FE only
be1/*     Backend (full) — e.g. be1/claim-evidence-v2
chore/*   one owner announced in Discord
contract/*  type/API shape — FE + Backend ack
```

> Legacy `be2/*` may appear in history; new Backend work uses `be1/`.

## Golden rules

1. **Don't touch files you don't own** (matrix in Implementation Plan §2).
2. **Backend never edits `app/page.tsx`** — FE mounts components and wires the verify queue.
3. **Backend owns `lib/types/debate.ts`** — v2 break uses handoff; afterward prefer additive changes.
4. **No manual speaker toggle** — ever.
5. **Verify is async** — never block extract/graph on `/api/verify-evidence`.
6. Agent MDs stay local/Discord — not in git history as shared truth. Do not `git add -f AGENT.md`.

## Phase gates (shortest path to demo)

| Gate | Meaning |
|---|---|
| A0 | App boots + types + Vercel project |
| B1 | Mic → transcript |
| B2 | `/api/extract` returns claims/evidence/relations |
| B3 | Speaker fields on responses |
| B4 | Full Must vertical slice (claim-only graph) |
| B5 | Production Must |
| FE handoff | FE adopts v2 via `FRONTEND_HANDOFF.md` before v2→`develop` |
| C | Should Haves (summary/fallback/confidence minimum) |
| D | Rehearsal hardened |

## First day

1. Name → role in Discord (**FE** or **Backend**).  
2. Each person keeps their `.agents/*.agent.md` locally.  
3. FE: follow [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md) against `be1/claim-evidence-v2`.  
4. Backend: keep `npm run test:backend` + `npm run typecheck:backend` green; publish fixtures + handoff.  
5. Do not merge v2 to `develop` until FE handoff QA is green.
