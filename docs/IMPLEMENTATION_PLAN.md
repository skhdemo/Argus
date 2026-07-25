# Argus — Implementation Plan

> **Source of truth for how we build.** Product scope lives in [`PRD.md`](./PRD.md).  
> **Personal day-to-day task lists** live in gitignored `.agents/*.agent.md` (Discord-distributed).  
> If an agent file conflicts with this plan or the PRD — **this plan + PRD win**.

---

## Claim–evidence v2 (current)

> **Breaking contract.** Branch `be1/claim-evidence-v2` holds the claim–evidence v2 ontology (not yet merged to `develop`).  
> **One Backend owner** now owns the **full backend** (former BE1 + BE2 scopes).  
> **FE adoption gate:** Frontend must integrate against [`docs/FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md) **before** merging v2 to `develop`. Backend intentionally leaves FE compile broken until that handoff is done.  
> **Mental model:** Claims are the **only** force-graph nodes; Evidence is attached (never a node); Relations are claim↔claim only (`counters` | `responds_to`). External corroboration is async via `POST /api/verify-evidence` (Google Search grounding) — **not** on the extract hot path.

---

## 0. How to use this document

1. Pick your role: **FE** or **Backend** (full) — see §1. (Historical notes may still say BE1/BE2 for old branch prefixes.)
2. Open your `.agents/<ROLE>.agent.md` (local only).
3. Work only on branches prefixed for your role (`fe/`, `be1/` — Backend uses `be1/` / `contract/` / `chore/`).
4. Touch only files you **own** (§2). If you need a change in someone else's file → open a Discord request + PR comment; owner merges.
5. Integrate via PRs into `develop` on the phase gates — **except** claim–evidence v2: FE must complete [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md) before that merge.
6. Never expand MoSCoW without updating `docs/PRD.md` first.

### Legend

| Tag | Meaning |
|---|---|
| **Owner: FE / Backend** | Person who implements and merges that work |
| **Reviewer:** | Who must approve the PR |
| **Contract** | Shared type/API surface — change only via PR labeled `contract` |
| **Gate** | Phase cannot start until prior gate is green |
| **FE handoff gate** | v2 backend must not merge to `develop` until FE adopts via `FRONTEND_HANDOFF.md` |

---

## 1. Roles & responsibilities

| Code | Domain | Primary ownership | Notes |
|---|---|---|---|
| **FE** | Frontend only | Speech UI, layout, claim-only graph shell, inspector (attached evidence), client session hooks, design system, SummaryPanel / badges mount | Reviews Backend contract PRs; owns all `app/page.tsx` + `components/*` + `hooks/*` |
| **Backend** | Full backend (former **BE1 + BE2**) | Gemini client, all `app/api/*`, `lib/types/debate.ts`, `lib/extract`, `lib/verify`, `lib/score`, `lib/summary`, `lib/fallacy`, `lib/speaker`, `lib/debate`, fixtures, env | One owner; branch prefix historically `be1/` (e.g. `be1/claim-evidence-v2`) |

### Collaboration rule (backend → frontend)

Backend **does not** edit FE-owned files. Ship APIs, types, fixtures, and [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md); FE adapts UI.

- Backend may propose optional render props / child components for graph polish — **FE is required reviewer** and owns the merge into `DebateGraph.tsx` / `page.tsx`.
- Backend does not take FE tasks unless FE is blocked and Discord-agrees a one-time handoff.

### FE handoff gate (claim–evidence v2)

1. Backend lands breaking types + routes on `be1/claim-evidence-v2`.
2. FE follows [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md) (state shape, claim-only graph, verify queue, score/summary).
3. Only after FE adoption + QA checklist → merge to `develop`.

---

## 2. File ownership matrix (do not cross)

### 2.1 Forever FE-owned

| Path | Notes |
|---|---|
| `app/page.tsx` | Session glue — FE only (verify queue wiring lives here) |
| `app/layout.tsx` | Root layout |
| `app/globals.css` | Tokens / atmosphere / display-status colors |
| `components/StartControls.tsx` | Start / Stop / listening state |
| `components/TranscriptPanel.tsx` | Live transcript list |
| `components/ClaimInspector.tsx` | Nature, display status, **attached** evidence + sources |
| `components/DebateGraph.tsx` | **Claim-only nodes**; relation strokes; optional evidence badge |
| `components/TextFallbackInput.tsx` | UI shell |
| `components/SummaryPanel.tsx` | Should Have UI — FE mounts |
| `components/FallacyBadge.tsx` | Should Have UI — FE |
| `components/SpeakerLabel.tsx` | Confidence-aware label — FE |
| `hooks/useSpeechRecognition.ts` | MediaRecorder → Gemini `/api/transcribe` |
| `hooks/useDebateSession.ts` | `claims` / `evidence` / `relations` client state |
| `hooks/useExtractionLoop.ts` | Polling/debounce → POST `/api/extract` |
| `hooks/useMomentum.ts` | Drive from `/api/score` or shared `computeDebateScore` |

### 2.2 Forever Backend-owned (full)

| Path | Notes |
|---|---|
| `lib/types/debate.ts` | **Contract file** — others import, never silent-edit |
| `lib/gemini/*` | `@google/genai` client + model pins |
| `lib/extract/*` | Prompts, Zod schemas, merge, fixtures |
| `lib/verify/*` | Google Search grounding / corroboration (async) |
| `lib/score/*` | Deterministic debate score |
| `lib/summary/*` | Summary prompt/schema |
| `lib/fallacy/*` | Fallacy heuristics / prompts |
| `lib/speaker/*` | Speaker inference |
| `lib/debate/*` | Derived status helpers (`status.ts`, etc.) |
| `app/api/transcribe/route.ts` | STT + diarization |
| `app/api/extract/route.ts` | Claim / evidence / relation deltas |
| `app/api/verify-evidence/route.ts` | Async corroboration (not on extract hot path) |
| `app/api/score/route.ts` | Structural score (no API key) |
| `app/api/summary/route.ts` | Stats + narrative + `debateScore` |
| `.env.example` | `GEMINI_API_KEY` + verify env vars (no secrets) |

### 2.3 Shared / chore (one owner per change, never parallel edit)

| Path | Default owner | Rule |
|---|---|---|
| `package.json` / lockfile | Whoever adds the dep in their PR | One dep PR at a time; rebase after |
| `next.config.ts` | FE | Backend may PR for server-only packages |
| `README.md` | Rotate — last deployer updates | |
| `docs/PRD.md` | Team (PR required) | |
| `docs/IMPLEMENTATION_PLAN.md` | Team (PR required) | |
| `docs/FRONTEND_HANDOFF.md` | Backend authors; FE consumes | Breaking contract migration bible |
| `docs/DEBATE_SCORING.md` | Backend | Score formula + proofs |

### 2.4 Hotspot avoidance

| Hotspot | Strategy |
|---|---|
| `app/page.tsx` | FE owns. Backend ships components/docs; FE imports. Backend never edits page except via FE-approved PR. |
| `lib/types/debate.ts` | Backend owns. Additive fields via `contract` PR after freeze. FE adapts UI after merge (or via handoff for v2 break). |
| `DebateGraph.tsx` | FE builds claim-only graph. Backend may suggest child components — FE reviews. |
| `/api/extract` | Backend owns; speaker inference called from the route via `lib/speaker/*`. |
| `/api/verify-evidence` | Backend owns; FE orchestrates queue (concurrency 1, never block graph). |

---

## 3. Branching & Git workflow

### 3.1 Long-lived branches

```
main          # demo-ready only; protected; Vercel production
develop       # integration; Vercel preview
```

### 3.2 Branch naming

```
fe/<short-slug>      # Frontend
be1/<short-slug>     # Backend (full) — historical prefix; e.g. be1/claim-evidence-v2
chore/<short-slug>   # Scaffold / tooling (assign one owner in Discord first)
contract/<short-slug># Changes to lib/types/debate.ts or API request/response shape
```

Examples:

- `fe/speech-hook`
- `be1/claim-evidence-v2` — **current breaking v2 contract branch**
- `be1/extract-route`
- `chore/next-scaffold`
- `contract/add-speaker-confidence`

> Legacy `be2/*` branches may still appear in git history; new work uses `be1/` (Backend) or `fe/`.

### 3.3 Rules of engagement

1. **One branch → one role prefix.** Never push to someone else's prefix.
2. **No force-push to `main` / `develop`.**
3. **Rebase onto `develop` before opening PR** (or merge develop in if rebase is painful — prefer rebase for small PRs).
4. **PR size:** prefer <400 LOC when possible; fixtures OK larger.
5. **Required reviewers:**
   - FE PRs → optional Backend if API consumer changed
   - Backend PRs → FE reviews if contract / handoff changes
   - Backend PRs touching FE files → **FE required**
   - `contract/*` → **FE + Backend** ack on Discord or PR
6. **Do not commit** `.env`, API keys, or `.agents/*.agent.md`.
7. **Merge order at gates** — don't merge Phase N+1 features into `develop` until Phase N gate is checked.
8. **Claim–evidence v2:** do **not** merge `be1/claim-evidence-v2` to `develop` until FE completes [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md).

### 3.4 Suggested Discord channels

- `#argus-general` — decisions, MoSCoW changes
- `#argus-fe` — FE status + handoff adoption
- `#argus-be` — Backend (full)
- `#argus-contracts` — type/API changes (ping FE + Backend)
- `#argus-demo` — rehearsal scripts, Vercel URLs

---

## 4. Shared contracts (claim–evidence v2)

> **Source of truth:** [`lib/types/debate.ts`](../lib/types/debate.ts).  
> **FE migration:** [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md).  
> **Scoring:** [`DEBATE_SCORING.md`](./DEBATE_SCORING.md).

**Removed vs v1:** `Claim.type` / `ClaimType`, `Claim.unsupported`, `Edge` / `edges` / `existingEdges`, `supports` / `contradicts` edge types, evidence-as-claim nodes.

### 4.0 Ontology

| Entity | Role |
|---|---|
| **Claim** | Only force-graph node. `nature`: `argument` \| `counterargument`. |
| **Evidence** | Speaker-provided justification (`ev_` ids). **Never** a graph node. Attached via `supportsClaimIds`. |
| **Relation** | Claim→claim only: `counters` \| `responds_to`. |

Two support axes:

1. **Speaker support** (did they offer evidence?) — derived: `unsupported` \| `evidence_provided`
2. **External corroboration** — stored on `Evidence.verification` (never a claim true/false label)

**Messi regression:** “Messi is better because he won a World Cup…” → **one claim node** + **one attached evidence** item — never two claim nodes.

### 4.1 Extract request (`POST /api/extract`)

```ts
// lib/types/debate.ts — illustrative; Backend is source of truth
export type ExtractRequest = {
  text: string;
  transcriptWindow?: string;
  inferredSpeaker?: SpeakerId | null;
  pauseMs?: number;
  existingClaims: Claim[];
  existingEvidence: Evidence[];
  existingRelations: Relation[];
};
```

### 4.2 Extract response (deltas)

```ts
export type SpeakerId = "A" | "B" | "UNKNOWN";
export type ClaimNature = "argument" | "counterargument";
export type RelationType = "counters" | "responds_to";

export type Claim = {
  id: string;                 // c_…
  text: string;
  speaker: SpeakerId;
  speakerConfidence?: number;
  nature: ClaimNature;
  fallacies?: FallacyTag[];
  sourceExcerpt?: string;
  createdAt: number;
};

export type Evidence = {
  id: string;                 // ev_…
  text: string;
  speaker: SpeakerId;
  supportsClaimIds: string[]; // claim ids this evidence backs
  kind: EvidenceKind;
  verification: EvidenceVerification; // usually pending at extract time
  createdAt: number;
};

export type Relation = {
  id: string;
  from: string; // claim id
  to: string;   // claim id
  type: RelationType;
};

export type ExtractResponse = {
  claims: Claim[];
  evidence: Evidence[];
  relations: Relation[];
  inferredSpeaker: SpeakerId;
  speakerConfidence: number;
  notes?: string;
};
```

Extract identifies structure only. It does **not** label claim true/false. Corroboration is a separate async path (§4.3).

### 4.3 Verify evidence (`POST /api/verify-evidence`) — async

**Not on the extract hot path.** FE enqueues after extract; global concurrency 1.

```ts
export type VerifyEvidenceRequest = {
  evidence: Evidence;
  claim: Claim;       // primary claim for relevance
  force?: boolean;
};

export type VerifyEvidenceResponse = {
  evidenceId: string;
  verification: EvidenceVerification; // corroborated | contested | …
  displayStatusHint?: ClaimDisplayStatus;
};
```

Uses Gemini + **Google Search grounding**. Anecdotes / reasoning may short-circuit to `not_verifiable` (HTTP 200).

Env: `ARGUS_VERIFY_ENABLED` (default on unless `false`), `ARGUS_VERIFY_CONCURRENCY=1`, optional `GEMINI_VERIFY_MODEL`.

### 4.4 Score (`POST /api/score`)

Request: `{ claims, evidence, relations }` → `DebateScoreSnapshot` (`scoreA`/`scoreB` sum to 100). No API key. See [`DEBATE_SCORING.md`](./DEBATE_SCORING.md).

### 4.5 Summary (`POST /api/summary`)

Request: `{ claims, evidence, relations }`.  
Response: stats (`claimCount`, `evidenceCount` = **attached Evidence items**, not support-edges, `unsupportedCount`, verification tallies, `mostContestedClaimId`) + `narrative` + required `debateScore`.

### 4.6 Visual encoding (FE — claim-only graph)

| Display status (derived) | Guidance |
|---|---|
| `unsupported` | no attached evidence |
| `pending_confirmation` | evidence pending verify |
| `supported` | corroborated + relevant |
| `weak_support` | weak / inconclusive |
| `contested_evidence` | sources contest |
| `not_externally_verifiable` | anecdote / not_verifiable |

| Claim nature | Role label (not support color) |
|---|---|
| `argument` | primary claim |
| `counterargument` | counter role |

| Relation type | Stroke |
|---|---|
| `counters` | dashed / attack stroke |
| `responds_to` | dotted / response stroke |

Evidence count may appear as a **badge** on the claim node. Evidence details live in Claim Inspector — never as green “evidence claim” nodes or `supports` edges.

### 4.7 Merge semantics

**Decision:** Server returns **deltas** (new/updated claims, evidence, relations). Client merges by `id`. Replace `verification` by evidence id when `/api/verify-evidence` returns. Ignore orphan evidence and invalid relation endpoints. Relation endpoints are always Claim ids (`c_…`). Backend documents this in `lib/extract/merge.ts` comments.
---

## 5. Phased plan (Epic → Phase → Task → Step)

---

# EPIC A — Foundation & contracts

**Goal:** Runnable Next.js app, env, types, empty routes, branch hygiene.  
**Demo value:** None yet — unlocks parallel work.

## Phase A0 — Repo bootstrap

**Gate A0:** `npm run dev` loads a blank branded shell; `develop` exists; ownership docs merged.

### Task A0.1 — Scaffold Next.js + Tailwind  
**Owner: FE** · Branch: `chore/next-scaffold` · Reviewer: Backend

| Step | Owner | Action |
|---|---|---|
| A0.1.1 | FE | `create-next-app` (App Router, TS, Tailwind, ESLint) in repo root |
| A0.1.2 | FE | Add `docs/` already present; ensure README has `npm i`, `npm run dev`, Chrome-only note |
| A0.1.3 | FE | Create placeholder folders: `components/`, `hooks/`, `lib/types/`, `lib/gemini/`, `lib/extract/`, `lib/verify/`, `lib/score/`, `lib/speaker/`, `lib/summary/`, `lib/fallacy/`, `lib/debate/` with `.gitkeep` where needed |
| A0.1.4 | FE | Push `chore/next-scaffold` → PR → merge `develop` |

### Task A0.2 — Env & Vercel project  
**Owner: Backend** · Branch: `chore/env-vercel` · Reviewer: FE

| Step | Owner | Action |
|---|---|---|
| A0.2.1 | Backend | Add `.env.example` with `GEMINI_API_KEY=` (+ verify env stubs) |
| A0.2.2 | Backend | Create Vercel project linked to repo; set Production = `main`, Preview = all |
| A0.2.3 | Backend | Add `GEMINI_API_KEY` in Vercel env (Production + Preview) — never commit key |
| A0.2.4 | Backend | Document in README: who holds the key, how to rotate, verify env vars |

### Task A0.3 — Contract stub  
**Owner: Backend** · Branch: `contract/initial-types` · Reviewer: FE

| Step | Owner | Action |
|---|---|---|
| A0.3.1 | Backend | Create `lib/types/debate.ts` with Claim, Evidence, Relation, ExtractRequest/Response stubs |
| A0.3.2 | Backend | Export from a single entry; no runtime deps |
| A0.3.3 | Backend | Post Discord `#argus-contracts`: freeze notice — additive only after this (v2 break uses handoff) |
| A0.3.4 | FE | Ack types; start importing in hooks as `import type` |
| A0.3.5 | Backend | List planned fields (`speakerConfidence`, `fallacies`, verification) as comments where deferred |

**Gate A0 checklist**

- [ ] App boots
- [ ] Types merged
- [ ] Vercel project exists
- [ ] Everyone has local `.agents/*.agent.md` (gitignored)

---

# EPIC B — Must Have vertical slice

**Goal:** Speak → infer speaker → extract → graph updates → inspector.  
**Demo value:** Core wow path.

## Phase B1 — Speech capture (client)

**Owner: FE** · Depends on: Gate A0

### Task B1.1 — `useSpeechRecognition`  
**Owner: FE** · Branch: `fe/speech-hook`

| Step | Owner | Action |
|---|---|---|
| B1.1.1 | FE | `'use client'` hook; feature-detect `webkitSpeechRecognition` / `SpeechRecognition` |
| B1.1.2 | FE | Continuous + interim results; accumulate final transcripts into a buffer |
| B1.1.3 | FE | Expose `{ isListening, start, stop, transcriptFinal, transcriptInterim, error, supported }` |
| B1.1.4 | FE | Auto-restart on `onend` while session active (Chrome quirk) |
| B1.1.5 | FE | Unit-smoke: manual test checklist in PR description (Chrome only) |

### Task B1.2 — Start controls + transcript panel  
**Owner: FE** · Branch: `fe/start-transcript-ui`

| Step | Owner | Action |
|---|---|---|
| B1.2.1 | FE | `StartControls`: Start / Stop, listening indicator |
| B1.2.2 | FE | `TranscriptPanel`: append-only list of final chunks with timestamps |
| B1.2.3 | FE | Desktop layout shell in `page.tsx` (graph area + side panel placeholders) |
| B1.2.4 | FE | Design tokens in `globals.css` — avoid generic purple/AI look per team taste; dark debate-board atmosphere OK if intentional |
| B1.2.5 | FE | Show clear error if not Chrome / no mic permission |

**Gate B1:** Mic → text appears in transcript within ~1s. No API yet.

---

## Phase B2 — Extraction API (Gemini)

**Owner: Backend** · Depends on: Gate A0 · Parallel with B1

### Task B2.1 — Gemini client  
**Owner: Backend** · Branch: `be1/gemini-client`

| Step | Owner | Action |
|---|---|---|
| B2.1.1 | Backend | Add `@google/genai` dependency |
| B2.1.2 | Backend | `lib/gemini/client.ts` — read `process.env.GEMINI_API_KEY`, throw clear 500 if missing |
| B2.1.3 | Backend | `lib/gemini/models.ts` — pin latest Gemini 3-series model id; comment how to bump |
| B2.1.4 | Backend | Tiny script or route health check optional (`/api/extract` OPTIONS or GET returns model name) |

### Task B2.2 — Prompt + schema  
**Owner: Backend** · Branch: `be1/extract-prompt`

| Step | Owner | Action |
|---|---|---|
| B2.2.1 | Backend | Write extraction system prompt: Claims (`nature`: argument/counterargument), attached Evidence (`supportsClaimIds`), Relations (`counters`/`responds_to`) only; do **not** label claim true/false (corroboration is `/api/verify-evidence`) |
| B2.2.2 | Backend | Instruct model to use `existingClaims` / `existingEvidence` / `existingRelations` to link, not duplicate |
| B2.2.3 | Backend | Zod schema matching `ExtractResponse` deltas |
| B2.2.4 | Backend | Force JSON output mode / schema where SDK supports |
| B2.2.5 | Backend | Create 3 fixtures: claim-only, claim+attached-evidence, counter+`counters` relation under `lib/extract/fixtures/` |

### Task B2.3 — `/api/extract` route  
**Owner: Backend** · Branch: `be1/extract-route`

| Step | Owner | Action |
|---|---|---|
| B2.3.1 | Backend | Validate body with Zod; 400 on bad input |
| B2.3.2 | Backend | Call Gemini; parse; map to `ExtractResponse` |
| B2.3.3 | Backend | Assign stable ids (`c_` / `ev_` / relation prefixes + short uuid) |
| B2.3.4 | Backend | Wire `inferredSpeaker` / `speakerConfidence` via `lib/speaker/*` (or stub until ready) |
| B2.3.5 | Backend | Error handling: timeout, safety block, malformed JSON → 502 with `{ error }` |
| B2.3.6 | Backend | Manual curl/httpie examples in PR; FE can hit with fixture text |

### Task B2.4 — `/api/verify-evidence` (async corroboration)  
**Owner: Backend** · Branch: `be1/claim-evidence-v2` (or `be1/verify-evidence`)

| Step | Owner | Action |
|---|---|---|
| B2.4.1 | Backend | Gemini + Google Search grounding; update `Evidence.verification` |
| B2.4.2 | Backend | Never call from extract hot path; in-process concurrency via `ARGUS_VERIFY_CONCURRENCY` |
| B2.4.3 | Backend | Short-circuit anecdotes/reasoning → `not_verifiable` (HTTP 200) |
| B2.4.4 | FE | Enqueue pending evidence after extract; serialize globally (serverless is not a global lock) |

**Gate B2:** `POST /api/extract` with sample text returns valid JSON claims/evidence/relations. FE can call it from Thunder Client / curl. Verify is optional for Gate B2 but required before v2→`develop` merge.

---

## Phase B3 — Speaker inference (no manual toggle)

**Owner: Backend** · Depends on: Gate A0; integrates with B2

### Task B3.1 — Inference module  
**Owner: Backend** · Branch: `be1/speaker-infer`

| Step | Owner | Action |
|---|---|---|
| B3.1.1 | Backend | Implement `lib/speaker/infer.ts`: input = recent transcript window + last speaker; output = `{ speaker, confidence }` |
| B3.1.2 | Backend | Prefer single Gemini call strategy for hackathon: fold turn-boundary instructions into extract prompt when latency hurts |
| B3.1.3 | Backend | Heuristic fallback if Gemini fails: alternate A/B on long pauses / "I disagree" cues — mark confidence ≤ 0.4 |
| B3.1.4 | Backend | Unit-testable pure helpers for pause/cue heuristics (no network) |

### Task B3.2 — Wire into extract route  
**Owner: Backend** · Branch: `be1/wire-speaker`

| Step | Owner | Action |
|---|---|---|
| B3.2.1 | Backend | Import + one call site in `route.ts` (minimal diff) |
| B3.2.2 | Backend | Ensure latency still within demo budget (~2–5s total for extract) |
| B3.2.3 | Backend | Decide: **one Gemini call** (extract+speaker) vs **two calls**. Document in `lib/extract/prompt.ts` header. |
| B3.2.4 | Backend | Additive `speakerConfidence` on Claim + ExtractResponse if not already present |

**Gate B3:** Extract responses include `inferredSpeaker` + `speakerConfidence` that flip appropriately on a 2-voice pasted transcript fixture.

---

## Phase B4 — Client extraction loop + claim-only graph

**Owner: FE** · Depends on: Gate B1 + B2 (B3 nice-to-have in parallel) · **v2:** follow [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md)

### Task B4.1 — `useDebateSession`  
**Owner: FE** · Branch: `fe/debate-session`

| Step | Owner | Action |
|---|---|---|
| B4.1.1 | FE | Hold `claims[]`, `evidence[]`, `relations[]`, `transcript[]` in React state |
| B4.1.2 | FE | `mergeExtractResponse(delta)` by id; replace verification by evidence id |
| B4.1.3 | FE | Select claim id for inspector (never select Evidence as a graph node) |

### Task B4.2 — `useExtractionLoop`  
**Owner: FE** · Branch: `fe/extraction-loop`

| Step | Owner | Action |
|---|---|---|
| B4.2.1 | FE | Debounce: every N seconds OR every M final chars (tune: start 3s / 80 chars) |
| B4.2.2 | FE | POST `/api/extract` with `{ text, existingClaims, existingEvidence, existingRelations }` |
| B4.2.3 | FE | Ignore stale responses (request seq number) |
| B4.2.4 | FE | Surface non-fatal toast/banner on API error; keep listening |
| B4.2.5 | FE | Dev-only: button "Inject fixture" using Backend fixtures (fetch static JSON) |
| B4.2.6 | FE | After extract, enqueue evidence with `verification.status === "pending"` → `/api/verify-evidence` (concurrency 1) |

### Task B4.3 — DebateGraph Must Have  
**Owner: FE** · Branch: `fe/debate-graph`

| Step | Owner | Action |
|---|---|---|
| B4.3.1 | FE | Dynamic import `react-force-graph-2d` with `ssr: false` |
| B4.3.2 | FE | Map **Claims only** → nodes (color by derived display status; nature for role label); Relations → links (`counters` / `responds_to`) |
| B4.3.3 | FE | Optional evidence-count badge on claim nodes; never render Evidence as nodes |
| B4.3.4 | FE | Click node → `onSelectClaim(id)` |
| B4.3.5 | FE | Empty state: "Waiting for first claim…" |
| B4.3.6 | FE | Performance: don't remount graph on every interim transcript |

### Task B4.4 — ClaimInspector Must Have  
**Owner: FE** · Branch: `fe/claim-inspector`

| Step | Owner | Action |
|---|---|---|
| B4.4.1 | FE | Show text, speaker, nature, display status, attached evidence (+ sources / verification) |
| B4.4.2 | FE | Close / deselect |
| B4.4.3 | FE | Placeholder slot for fallacy badge / confidence |

### Task B4.5 — Wire page  
**Owner: FE** · Branch: `fe/wire-page`

| Step | Owner | Action |
|---|---|---|
| B4.5.1 | FE | Compose StartControls + Transcript + Graph + Inspector + verify queue |
| B4.5.2 | FE | End-to-end manual test with mic + live API (Messi → one node + attached evidence) |
| B4.5.3 | FE | Record 60s screen capture for Discord |

**Gate B4 (Must Have vertical slice):** Two people talk → claim-only graph grows → click node shows inspector with attached evidence. Speaker labels present (even if imperfect). Deploy preview URL works. **v2→`develop` requires handoff checklist green.**

---

## Phase B5 — Deploy Must Have

**Owner: Backend (Vercel) + FE (smoke)** · Branch: merge `develop` → `main` (only after FE handoff if deploying v2)

| Step | Owner | Action |
|---|---|---|
| B5.1 | Backend | Confirm env on Production (`GEMINI_API_KEY` + verify vars) |
| B5.2 | FE | Smoke test production URL on demo machine Chrome |
| B5.3 | Backend | Run speaker + Messi fixtures against prod extract/verify |
| B5.4 | All | Tag `v0.1.0-must` |

**Gate B5:** Production URL is demo-safe for Must Have.

---

﻿# EPIC C — Should Haves (parallel tracks)

**Start only after Gate B4.** Split so FE / Backend still don't collide.

## Phase C1 — Summary (Backend API + FE UI)

### Task C1.1 — Summary API  
**Owner: Backend** · Branch: `be1/summary-api`

| Step | Owner | Action |
|---|---|---|
| C1.1.1 | Backend | `lib/summary/prompt.ts` + `schema.ts` |
| C1.1.2 | Backend | `POST /api/summary` with `{ claims, evidence, relations }` → stats + narrative + `debateScore` |
| C1.1.3 | Backend | Reuse `lib/gemini/client.ts`; `evidenceCount` = attached Evidence items (not legacy support-edges) |

### Task C1.2 — SummaryPanel UI  
**Owner: FE** · Branch: `fe/summary-panel`

| Step | Owner | Action |
|---|---|---|
| C1.2.1 | FE | Create `components/SummaryPanel.tsx` |
| C1.2.2 | FE | Button "Generate summary" → call API with current claims/evidence/relations |
| C1.2.3 | FE | Mount `<SummaryPanel />` in `page.tsx` |

---

## Phase C2 — Derived unsupported + fallacies

### Task C2.1 — Fallacy tags in extract pipeline  
**Owner: Backend** · Branch: `be1/fallacy-tags`  
**Contract PR first if needed:** `contract/fallacies`

| Step | Owner | Action |
|---|---|---|
| C2.1.1 | Backend | Soft `fallacies?: FallacyTag[]` on Claim (additive). Speaker support is **derived** from attached Evidence — not a persisted `unsupported` Claim field / ClaimType |
| C2.1.2 | Backend | Implement `lib/fallacy/*`; prefer folding into extract prompt |
| C2.1.3 | Backend | Keep JSON schema compatible; UI language: never "this claim is false" |

### Task C2.2 — Visual flags  
**Owner: FE** · Branch: `fe/fallacy-ui`

| Step | Owner | Action |
|---|---|---|
| C2.2.1 | FE | `FallacyBadge.tsx` |
| C2.2.2 | FE | Soft ring/icon for derived `unsupported` / weak display status (not "false") |
| C2.2.3 | FE | Keep graph diffs surgical; optional child components only |

---

## Phase C3 — Animations + low-confidence speaker styling

### Task C3.1 — Entrance animation  
**Owner: FE** · Branch: `fe/graph-anim`

| Step | Owner | Action |
|---|---|---|
| C3.1.1 | FE | Animate new claim nodes (opacity/scale) on add; do not restart simulation harshly |
| C3.1.2 | FE | Subtle relation draw-in if cheap; skip if janky |

### Task C3.2 — Confidence styling  
**Owner: FE** · Branch: `fe/speaker-confidence-ui`

| Step | Owner | Action |
|---|---|---|
| C3.2.1 | FE | `SpeakerLabel.tsx`: if confidence < 0.55 → "Speaker A?" + muted opacity |
| C3.2.2 | FE | Use in Inspector + graph labels |

---

## Phase C4 — Text fallback (mic failure)

### Task C4.1 — UI  
**Owner: FE** · Branch: `fe/text-fallback`

| Step | Owner | Action |
|---|---|---|
| C4.1.1 | FE | `TextFallbackInput`: textarea + submit injects into transcript buffer as a final chunk |
| C4.1.2 | FE | Same extraction loop consumes it — no special API |

### Task C4.2 — Polish / demo fail-safe  
**Owner: FE** · Branch: `fe/fallback-help`

| Step | Owner | Action |
|---|---|---|
| C4.2.1 | FE | Add keyboard shortcut hint / "Demo paste" that loads a rehearsal script fixture |
| C4.2.2 | FE | Mount in page |

**Gate C:** At least Summary + text fallback + confidence styling shipped on preview. Fallacies/animations best-effort.

---

# EPIC D — Demo hardening

**Goal:** Zero crashes; rehearsed script; known failure modes.

## Phase D1 — Rehearsal kit

| Step | Owner | Action |
|---|---|---|
| D1.1 | All | Write 60–90s debate script in `docs/DEMO_SCRIPT.md` (FE creates file, all edit via PR) |
| D1.2 | Backend | Tune extract prompt against script until claim/evidence/relation graph looks right (Messi → one node + evidence) |
| D1.3 | Backend | Tune speaker inference against same script |
| D1.4 | FE | Practice Start → talk → click inspector → summary on demo laptop; verify queue stays non-blocking |

## Phase D2 — Resilience

| Step | Owner | Action |
|---|---|---|
| D2.1 | FE | Guard all `window` access; no SSR crashes |
| D2.2 | Backend | Rate-limit / single-flight extract; verify concurrency env |
| D2.3 | FE | If speaker confidence always low, show hedging always rather than wrong certainty |
| D2.4 | Backend | Logging: server logs latency ms (no transcript PII in Vercel if avoidable) |

## Phase D3 — Cut Could Haves ruthlessly

Only if Gates B5 + C (partial) are green and time remains — pick **one**:

| Option | Owner |
|---|---|
| Transcript sync | FE |
| Replay mode | FE |
| Steelman mode | Backend (API) + FE (UI) |
| Post-hoc speaker relabel | FE (UI) + Backend contract |

Default recommendation: **skip Could Haves** unless demo is already boring.

---

# EPIC E — Could Haves (optional backlog)

Do not schedule until D1 rehearsal passes. Keep as backlog tickets only.

| ID | Item | Owner if pulled |
|---|---|---|
| E1 | Transcript sync | FE |
| E2 | Replay mode | FE |
| E3 | Steelman Mode | Backend API + FE UI |
| E4 | Stronger derived-support / display-status UX | FE + Backend |
| E5 | Topic clustering | Backend |
| E6 | Post-hoc speaker relabel | FE |

---

## 6. Parallelization map (who works when)

```
Week/hackathon timeline (adjust to your window)
────────────────────────────────────────────────
Phase A0     FE: scaffold ────────┐
             Backend: env+types ──┼── Gate A0

Phase B1     FE: speech+UI ─────────────────────┐
Phase B2     Backend: gemini+extract+verify ────┼── Gate B2/B1
Phase B3     Backend: speaker infer ────────────┘

Phase B4     FE: loop+claim-only graph+inspector+verify queue
             (v2 handoff: FRONTEND_HANDOFF.md before develop merge)
Phase B5     All: deploy Must

Phase C      Backend: summary/fallacy APIs
             FE: summary UI + text fallback + confidence styling

Phase D      All: rehearsal + harden
```

**Maximum parallel no-conflict sets**

| Concurrent | Safe because |
|---|---|
| FE B1 + Backend B2 | Different files |
| FE B4 + Backend B3 | Backend only touches `lib/speaker` / extract route |
| FE C4.1 + Backend C1 | Different files |

**Never parallel**

- Two people editing `lib/types/debate.ts`
- Two people editing `app/page.tsx`
- Two people editing `app/api/extract/route.ts`
- Two people adding deps to `package.json` without sequencing

---

## 7. Definition of Done (per PR)

- [ ] Only owns files for the role (or has required reviewer ack)
- [ ] Types match `lib/types/debate.ts` (v2 ontology)
- [ ] No secrets committed
- [ ] Manual test notes in PR body
- [ ] Rebased on `develop` (v2: FE handoff green before merge)
- [ ] Does not implement Won't Haves
- [ ] Backend: `npm run test:backend` + `npm run typecheck:backend` green when touching API/lib

---

## 8. Risk register & mitigations

| Risk | Owner | Mitigation |
|---|---|---|
| Extraction quality poor | Backend | Fixtures + scripted rehearsal; iterate prompt early; Messi regression |
| Speaker misattribution on stage | Backend + FE | Low-confidence styling; rehearse seating/voices; hedging copy |
| Graph SSR / window crash | FE | Dynamic import + client guards |
| API latency >5s | Backend | One Gemini call for extract; shrink prompt context; keep verify **off** hot path |
| Verify rate limits | FE + Backend | FE concurrency 1; retry 429; never freeze graph |
| Mic fails live | FE | Text fallback + demo paste script |
| Merge conflicts on page.tsx | FE | Only FE mounts; Backend ships docs/APIs |
| Contract thrash / premature develop merge | All | FE completes `FRONTEND_HANDOFF.md` before v2→`develop` |

---

## 9. Communication protocol (Discord)

When blocked on someone else's file:

1. Post in `#argus-contracts` or `#argus-be` / `#argus-fe` with: file path, why, proposed diff summary.
2. Owner responds within agreed SLA (suggest 2h during hackathon).
3. Owner either: (a) makes the change, or (b) invites a short paired PR.

Daily standup (15 min): each role answers — **done / next / blocked / gate status** (include FE handoff status while on `be1/claim-evidence-v2`).

---

## 10. Mapping: MoSCoW → owners summary

| Feature | Primary | Helper |
|---|---|---|
| Gemini audio STT + diarization | Backend | FE (MediaRecorder hook) |
| Auto speaker inference | Backend | — |
| `/api/extract` + Gemini | Backend | FE consumer |
| `/api/verify-evidence` + Search | Backend | FE verify queue |
| `/api/score` | Backend | FE momentum |
| Live claim-only graph | FE | — |
| Relation strokes + evidence badges | FE | — |
| Claim Inspector (attached evidence) | FE | — |
| Vercel deploy | Backend | FE smoke |
| Summary panel | FE | Backend API |
| Derived unsupported / display status | FE + Backend helpers | — |
| Fallacy detection | Backend | FE badges |
| Animations | FE | — |
| Low-confidence styling | FE | — |
| Text fallback | FE | — |

---

## 11. First actions after reading this (today)

1. Assign humans to **FE** + **Backend (full)** in Discord.  
2. Copy the matching `.agents/*.agent.md` template locally (already gitignored).  
3. FE: adopt [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md) against `be1/claim-evidence-v2` before any v2→`develop` merge.  
4. Backend: keep `npm run test:backend` + `npm run typecheck:backend` green; do not edit FE sources for the break.  
5. Both: treat Claims as nodes, Evidence as attached, Relations as claim↔claim only.

---

*End of implementation plan. Update via PR when gates slip or MoSCoW changes — keep PRD and this file synchronized.*
