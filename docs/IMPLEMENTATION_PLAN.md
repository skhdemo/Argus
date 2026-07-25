# Argus — Implementation Plan

> **Source of truth for how we build.** Product scope lives in [`PRD.md`](./PRD.md).  
> **Personal day-to-day task lists** live in gitignored `.agents/*.agent.md` (Discord-distributed).  
> If an agent file conflicts with this plan or the PRD — **this plan + PRD win**.

---

## 0. How to use this document

1. Pick your role: **FE**, **BE1**, or **BE2** (see §1).
2. Open your `.agents/<ROLE>.agent.md` (local only).
3. Work only on branches prefixed for your role (`fe/`, `be1/`, `be2/`).
4. Touch only files you **own** (§2). If you need a change in someone else's file → open a Discord request + PR comment; owner merges.
5. Integrate via PRs into `develop` on the phase gates in §4.
6. Never expand MoSCoW without updating `docs/PRD.md` first.

### Legend

| Tag | Meaning |
|---|---|
| **Owner: FE / BE1 / BE2** | Person who implements and merges that work |
| **Reviewer:** | Who must approve the PR |
| **Contract** | Shared type/API surface — change only via PR labeled `contract` |
| **Gate** | Phase cannot start until prior gate is green |

---

## 1. Roles & responsibilities

| Code | Domain | Primary ownership | Secondary (later phases) |
|---|---|---|---|
| **FE** | Frontend only | Speech UI, layout, graph shell, inspector, client session hooks, design system | Stays on FE; reviews BE2 advanced UI PRs |
| **BE1** | Backend — extraction core | Gemini client, `/api/extract`, Zod schemas, claim/evidence/edge prompts, `lib/types/debate.ts` contract | Light help: extraction loop contract docs; mock fixtures for FE |
| **BE2** | Backend — inference + Should Haves | Speaker inference, `/api/summary`, fallacy detection, confidence fields | Advanced FE: SummaryPanel, entrance animations, fallacy icons, low-confidence speaker styling, text-fallback wiring |

### Collaboration rule (backend → frontend)

BE1 and BE2 **do not** edit FE-owned files until **Phase 3 Gate** is green (Must Have vertical slice works). After that:

- BE2 may own new component files listed in §2.3.
- BE2 may open PRs that **touch** `DebateGraph.tsx` for animation/fallacy icons — but FE is **required reviewer**.
- BE1 does not take FE tasks unless FE is blocked and Discord-agrees a one-time handoff.

---

## 2. File ownership matrix (do not cross)

### 2.1 Forever FE-owned

| Path | Notes |
|---|---|
| `app/page.tsx` | Session glue — FE only |
| `app/layout.tsx` | Root layout |
| `app/globals.css` | Tokens / atmosphere |
| `components/StartControls.tsx` | Start / Stop / listening state |
| `components/TranscriptPanel.tsx` | Live transcript list |
| `components/ClaimInspector.tsx` | Basic inspector |
| `components/DebateGraph.tsx` | **Shell + data binding** owned by FE; BE2 may PR polish (see §2.3) |
| `components/TextFallbackInput.tsx` | UI shell |
| `hooks/useSpeechRecognition.ts` | Web Speech API wrapper |
| `hooks/useDebateSession.ts` | Client graph/transcript state |
| `hooks/useExtractionLoop.ts` | Polling/debounce → POST `/api/extract` |

### 2.2 Forever BE1-owned

| Path | Notes |
|---|---|
| `lib/types/debate.ts` | **Contract file** — others import, never silent-edit |
| `lib/gemini/client.ts` | `@google/genai` singleton |
| `lib/gemini/models.ts` | Model id constant (Gemini 3+) |
| `lib/extract/prompt.ts` | Extraction system/user prompts |
| `lib/extract/schema.ts` | Zod / JSON schema for Gemini response |
| `lib/extract/merge.ts` | Dedup / id assignment helpers (server-side) |
| `app/api/extract/route.ts` | POST handler |
| `lib/extract/fixtures/*.json` | Golden fixtures for local FE mocks |
| `.env.example` | Documents `GEMINI_API_KEY` only (no secrets) |

### 2.3 Forever BE2-owned

| Path | Notes |
|---|---|
| `lib/speaker/infer.ts` | Turn / speaker inference |
| `lib/speaker/prompt.ts` | Speaker prompt if separate Gemini call |
| `lib/speaker/types.ts` | Extends contract fields for confidence |
| `lib/summary/prompt.ts` | Summary prompt |
| `lib/summary/schema.ts` | Summary response schema |
| `app/api/summary/route.ts` | POST summary |
| `lib/fallacy/detect.ts` | Fallacy heuristics / Gemini call |
| `lib/fallacy/prompt.ts` | Fallacy prompt |
| `components/SummaryPanel.tsx` | Should Have UI (new file — BE2) |
| `components/FallacyBadge.tsx` | Should Have UI (new file — BE2) |
| `components/SpeakerLabel.tsx` | Confidence-aware label (new file — BE2) |

### 2.4 Shared / chore (one owner per change, never parallel edit)

| Path | Default owner | Rule |
|---|---|---|
| `package.json` / lockfile | Whoever adds the dep in their PR | One dep PR at a time; rebase after |
| `tailwind.config.ts` | FE | BE2 may request tokens via Discord |
| `next.config.ts` | FE | BE1 may PR for server-only packages |
| `README.md` | Rotate — last deployer updates | |
| `docs/PRD.md` | Team (PR required) | |
| `docs/IMPLEMENTATION_PLAN.md` | Team (PR required) | |

### 2.5 Hotspot avoidance

| Hotspot | Strategy |
|---|---|
| `app/page.tsx` | FE owns. BE2 exports components; FE imports them. BE never edits page except via FE-approved PR. |
| `lib/types/debate.ts` | BE1 owns. BE2 proposes additive fields (`speakerConfidence`, `fallacies[]`) in a `contract` PR. FE adapts UI after merge. |
| `DebateGraph.tsx` | FE builds Must. BE2 adds animation/fallacy via feature flag props or small child components to minimize merge conflict. |
| `/api/extract` | BE1 owns route. BE2's speaker inference is **called from** the route via `lib/speaker/*` import — BE2 PRs that touch `route.ts` need BE1 review; prefer BE1 wiring one `await inferSpeaker(...)` call. |

---

## 3. Branching & Git workflow

### 3.1 Long-lived branches

```
main          # demo-ready only; protected; Vercel production
develop       # integration; Vercel preview
```

### 3.2 Branch naming

```
fe/<short-slug>      # Frontend person
be1/<short-slug>     # Backend extract
be2/<short-slug>     # Backend infer + advanced FE
chore/<short-slug>   # Scaffold / tooling (assign one owner in Discord first)
contract/<short-slug># Changes to lib/types/debate.ts or API request/response shape
```

Examples:

- `fe/speech-hook`
- `be1/extract-route`
- `be2/speaker-infer`
- `chore/next-scaffold`
- `contract/add-speaker-confidence`

### 3.3 Rules of engagement

1. **One branch → one role prefix.** Never push to someone else's prefix.
2. **No force-push to `main` / `develop`.**
3. **Rebase onto `develop` before opening PR** (or merge develop in if rebase is painful — prefer rebase for small PRs).
4. **PR size:** prefer <400 LOC when possible; fixtures OK larger.
5. **Required reviewers:**
   - FE PRs → optional BE1 if API consumer changed
   - BE1 PRs → BE2 reviews speaker integration points; FE reviews if contract changes
   - BE2 PRs touching FE files → **FE required**
   - `contract/*` → **FE + BE1 + BE2** all ack on Discord or PR
6. **Do not commit** `.env`, API keys, or `.agents/*.agent.md`.
7. **Merge order at gates** is defined in §4 — don't merge Phase N+1 features into `develop` until Phase N gate is checked.

### 3.4 Suggested Discord channels

- `#argus-general` — decisions, MoSCoW changes
- `#argus-fe` — FE status
- `#argus-be` — BE1 + BE2
- `#argus-contracts` — type/API changes (ping all three)
- `#argus-demo` — rehearsal scripts, Vercel URLs

---

## 4. Shared contracts (freeze early)

### 4.1 Extract request (`POST /api/extract`)

```ts
// lib/types/debate.ts — illustrative; BE1 is source of truth
export type ExtractRequest = {
  text: string;                       // new transcript chunk(s) since last call
  transcriptWindow?: string;          // optional recent context
  inferredSpeaker?: SpeakerId | null; // client may pass hint; server may override
  existingClaims: Claim[];
  existingEdges: Edge[];
};
```

### 4.2 Extract response

```ts
export type SpeakerId = "A" | "B" | "UNKNOWN";

export type ClaimType =
  | "supported"
  | "assumption"
  | "needs_evidence"
  | "counterargument";

export type EdgeType = "supports" | "contradicts" | "responds_to";

export type Claim = {
  id: string;
  text: string;
  speaker: SpeakerId;
  speakerConfidence?: number; // 0–1; BE2 adds in contract PR
  type: ClaimType;
  unsupported?: boolean;      // Should Have soft flag
  fallacies?: FallacyTag[];   // Should Have
  sourceExcerpt?: string;     // for Could Have transcript sync
  createdAt: number;
};

export type Edge = {
  id: string;
  from: string; // claim id
  to: string;   // claim id
  type: EdgeType;
};

export type ExtractResponse = {
  claims: Claim[];      // new or updated claims only (document merge semantics)
  edges: Edge[];        // new edges only
  inferredSpeaker: SpeakerId;
  speakerConfidence: number;
  notes?: string;       // debug; hide in prod UI
};
```

### 4.3 Summary request/response (BE2)

```ts
export type SummaryRequest = {
  claims: Claim[];
  edges: Edge[];
};

export type SummaryResponse = {
  claimCount: number;
  evidenceCount: number;
  unsupportedCount: number;
  mostContestedClaimId: string | null;
  narrative: string;
};
```

### 4.4 Visual encoding (FE must match PRD)

| Claim type | Color |
|---|---|
| supported | green |
| assumption | yellow |
| needs_evidence | red |
| counterargument | blue |

| Edge type | Stroke |
|---|---|
| supports | solid |
| contradicts | dashed (or red-tinted) |
| responds_to | dotted / arrowed |

### 4.5 Merge semantics (agree in Phase 1)

**Decision (default):** Server returns **deltas** (new claims/edges). Client merges by `id`. If Gemini returns an update to an existing claim, server reuses the same `id` and client replaces that node. BE1 documents this in `lib/extract/merge.ts` comments.

---

## 5. Phased plan (Epic → Phase → Task → Step)

---

# EPIC A — Foundation & contracts

**Goal:** Runnable Next.js app, env, types, empty routes, branch hygiene.  
**Demo value:** None yet — unlocks parallel work.

## Phase A0 — Repo bootstrap

**Gate A0:** `npm run dev` loads a blank branded shell; `develop` exists; ownership docs merged.

### Task A0.1 — Scaffold Next.js + Tailwind  
**Owner: FE** · Branch: `chore/next-scaffold` · Reviewer: BE1

| Step | Owner | Action |
|---|---|---|
| A0.1.1 | FE | `create-next-app` (App Router, TS, Tailwind, ESLint) in repo root |
| A0.1.2 | FE | Add `docs/` already present; ensure README has `npm i`, `npm run dev`, Chrome-only note |
| A0.1.3 | FE | Create placeholder folders: `components/`, `hooks/`, `lib/types/`, `lib/gemini/`, `lib/extract/`, `lib/speaker/`, `lib/summary/`, `lib/fallacy/` with `.gitkeep` where needed |
| A0.1.4 | FE | Push `chore/next-scaffold` → PR → merge `develop` |

### Task A0.2 — Env & Vercel project  
**Owner: BE1** · Branch: `chore/env-vercel` · Reviewer: BE2

| Step | Owner | Action |
|---|---|---|
| A0.2.1 | BE1 | Add `.env.example` with `GEMINI_API_KEY=` |
| A0.2.2 | BE1 | Create Vercel project linked to repo; set Production = `main`, Preview = all |
| A0.2.3 | BE1 | Add `GEMINI_API_KEY` in Vercel env (Production + Preview) — never commit key |
| A0.2.4 | BE1 | Document in README: who holds the key, how to rotate |

### Task A0.3 — Contract stub  
**Owner: BE1** · Branch: `contract/initial-types` · Reviewer: FE + BE2

| Step | Owner | Action |
|---|---|---|
| A0.3.1 | BE1 | Create `lib/types/debate.ts` with Claim, Edge, ExtractRequest/Response stubs |
| A0.3.2 | BE1 | Export from a single entry; no runtime deps |
| A0.3.3 | BE1 | Post Discord `#argus-contracts`: freeze notice — additive only after this |
| A0.3.4 | FE | Ack types; start importing in hooks as `import type` |
| A0.3.5 | BE2 | Ack; list planned additive fields (`speakerConfidence`, `fallacies`) as comments `// FUTURE BE2` |

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

**Owner: BE1** · Depends on: Gate A0 · Parallel with B1

### Task B2.1 — Gemini client  
**Owner: BE1** · Branch: `be1/gemini-client`

| Step | Owner | Action |
|---|---|---|
| B2.1.1 | BE1 | Add `@google/genai` dependency |
| B2.1.2 | BE1 | `lib/gemini/client.ts` — read `process.env.GEMINI_API_KEY`, throw clear 500 if missing |
| B2.1.3 | BE1 | `lib/gemini/models.ts` — pin latest Gemini 3-series model id; comment how to bump |
| B2.1.4 | BE1 | Tiny script or route health check optional (`/api/extract` OPTIONS or GET returns model name) |

### Task B2.2 — Prompt + schema  
**Owner: BE1** · Branch: `be1/extract-prompt`

| Step | Owner | Action |
|---|---|---|
| B2.2.1 | BE1 | Write extraction system prompt: identify claims, evidence, edges only (`supports`/`contradicts`/`responds_to`); no fact-checking |
| B2.2.2 | BE1 | Instruct model to use `existingClaims` to link, not duplicate |
| B2.2.3 | BE1 | Zod schema matching `ExtractResponse` deltas |
| B2.2.4 | BE1 | Force JSON output mode / schema where SDK supports |
| B2.2.5 | BE1 | Create 3 fixtures: claim-only, support-edge, contradict-edge under `lib/extract/fixtures/` |

### Task B2.3 — `/api/extract` route  
**Owner: BE1** · Branch: `be1/extract-route`

| Step | Owner | Action |
|---|---|---|
| B2.3.1 | BE1 | Validate body with Zod; 400 on bad input |
| B2.3.2 | BE1 | Call Gemini; parse; map to `ExtractResponse` |
| B2.3.3 | BE1 | Assign stable ids (`c_` / `e_` prefixes + short uuid) |
| B2.3.4 | BE1 | Stub `inferredSpeaker` / `speakerConfidence` fields (pass-through or `UNKNOWN` / `0.5`) until BE2 lands |
| B2.3.5 | BE1 | Error handling: timeout, safety block, malformed JSON → 502 with `{ error }` |
| B2.3.6 | BE1 | Manual curl/httpie examples in PR; FE can hit with fixture text |

**Integration note for BE2:** Leave a clear TODO comment:

```ts
// BE2: replace stub with inferSpeaker(...) from lib/speaker/infer.ts
```

**Gate B2:** `POST /api/extract` with sample text returns valid JSON claims/edges. FE can call it from Thunder Client / curl.

---

## Phase B3 — Speaker inference (no manual toggle)

**Owner: BE2** · Depends on: Gate A0; integrates with B2

### Task B3.1 — Inference module  
**Owner: BE2** · Branch: `be2/speaker-infer`

| Step | Owner | Action |
|---|---|---|
| B3.1.1 | BE2 | Implement `lib/speaker/infer.ts`: input = recent transcript window + last speaker; output = `{ speaker, confidence }` |
| B3.1.2 | BE2 | Prefer single Gemini call strategy for hackathon: include turn-boundary instructions in a dedicated prompt OR ask BE1 to merge speaker instructions into extract prompt (see B3.2) |
| B3.1.3 | BE2 | Heuristic fallback if Gemini fails: alternate A/B on long pauses / "I disagree" cues — mark confidence ≤ 0.4 |
| B3.1.4 | BE2 | Unit-testable pure helpers for pause/cue heuristics (no network) |

### Task B3.2 — Wire into extract route  
**Owner: BE2 proposes · BE1 merges** · Branch: `be2/wire-speaker` → PR requires **BE1**

| Step | Owner | Action |
|---|---|---|
| B3.2.1 | BE2 | Open PR that only adds import + one call site in `route.ts` (minimal diff) |
| B3.2.2 | BE1 | Review & merge; ensure latency still within demo budget (~2–5s total) |
| B3.2.3 | BE1 + BE2 | Decide: **one Gemini call** (extract+speaker) vs **two calls**. Prefer one call if latency hurts. Document decision in `lib/extract/prompt.ts` header. |
| B3.2.4 | BE2 | `contract/speaker-confidence` PR: additive fields on Claim + ExtractResponse |

**Gate B3:** Extract responses include `inferredSpeaker` + `speakerConfidence` that flip appropriately on a 2-voice pasted transcript fixture.

---

## Phase B4 — Client extraction loop + graph

**Owner: FE** · Depends on: Gate B1 + B2 (B3 nice-to-have in parallel)

### Task B4.1 — `useDebateSession`  
**Owner: FE** · Branch: `fe/debate-session`

| Step | Owner | Action |
|---|---|---|
| B4.1.1 | FE | Hold `claims[]`, `edges[]`, `transcript[]` in React state |
| B4.1.2 | FE | `mergeExtractResponse(delta)` by id |
| B4.1.3 | FE | Select claim id for inspector |

### Task B4.2 — `useExtractionLoop`  
**Owner: FE** · Branch: `fe/extraction-loop`

| Step | Owner | Action |
|---|---|---|
| B4.2.1 | FE | Debounce: every N seconds OR every M final chars (tune: start 3s / 80 chars) |
| B4.2.2 | FE | POST `/api/extract` with `{ text, existingClaims, existingEdges }` |
| B4.2.3 | FE | Ignore stale responses (request seq number) |
| B4.2.4 | FE | Surface non-fatal toast/banner on API error; keep listening |
| B4.2.5 | FE | Dev-only: button "Inject fixture" using BE1 fixtures (fetch static JSON) |

### Task B4.3 — DebateGraph Must Have  
**Owner: FE** · Branch: `fe/debate-graph`

| Step | Owner | Action |
|---|---|---|
| B4.3.1 | FE | Dynamic import `react-force-graph-2d` with `ssr: false` |
| B4.3.2 | FE | Map claims → nodes (color by `type`); edges → links (stroke by `type`) |
| B4.3.3 | FE | Click node → `onSelectClaim(id)` |
| B4.3.4 | FE | Empty state: "Waiting for first claim…" |
| B4.3.5 | FE | Performance: don't remount graph on every interim transcript |

### Task B4.4 — ClaimInspector Must Have  
**Owner: FE** · Branch: `fe/claim-inspector`

| Step | Owner | Action |
|---|---|---|
| B4.4.1 | FE | Show text, speaker, type, linked edge list (ids → claim text) |
| B4.4.2 | FE | Close / deselect |
| B4.4.3 | FE | Placeholder slot for fallacy badge / confidence (BE2 fills later via children props) |

### Task B4.5 — Wire page  
**Owner: FE** · Branch: `fe/wire-page`

| Step | Owner | Action |
|---|---|---|
| B4.5.1 | FE | Compose StartControls + Transcript + Graph + Inspector |
| B4.5.2 | FE | End-to-end manual test with mic + live API |
| B4.5.3 | FE | Record 60s screen capture for Discord |

**Gate B4 (Must Have vertical slice):** Two people talk → graph grows → click node shows inspector. Speaker labels present (even if imperfect). Deploy preview URL works.

---

## Phase B5 — Deploy Must Have

**Owner: BE1 (Vercel) + FE (smoke)** · Branch: merge `develop` → `main`

| Step | Owner | Action |
|---|---|---|
| B5.1 | BE1 | Confirm env on Production |
| B5.2 | FE | Smoke test production URL on demo machine Chrome |
| B5.3 | BE2 | Run speaker fixture against prod extract |
| B5.4 | All | Tag `v0.1.0-must` |

**Gate B5:** Production URL is demo-safe for Must Have.

---

# EPIC C — Should Haves (parallel tracks)

**Start only after Gate B4.** Split so FE / BE1 / BE2 still don't collide.

## Phase C1 — Summary (BE2 backend + BE2 UI)

### Task C1.1 — Summary API  
**Owner: BE2** · Branch: `be2/summary-api`

| Step | Owner | Action |
|---|---|---|
| C1.1.1 | BE2 | `lib/summary/prompt.ts` + `schema.ts` |
| C1.1.2 | BE2 | `POST /api/summary` |
| C1.1.3 | BE2 | Reuse `lib/gemini/client.ts` (import only — do not edit; request BE1 if client needs extension) |

### Task C1.2 — SummaryPanel UI  
**Owner: BE2** · Branch: `be2/summary-panel` · **Reviewer: FE**

| Step | Owner | Action |
|---|---|---|
| C1.2.1 | BE2 | Create `components/SummaryPanel.tsx` (new file) |
| C1.2.2 | BE2 | Button "Generate summary" → call API with current claims/edges |
| C1.2.3 | FE | Import `<SummaryPanel />` into `page.tsx` in a tiny PR `fe/mount-summary` (FE owns page) |

> **Collision avoid:** BE2 never edits `page.tsx`. FE mounts the component.

---

## Phase C2 — Unsupported flagging + fallacies

### Task C2.1 — Fallacy + unsupported in extract pipeline  
**Owner: BE2** · Branch: `be2/fallacy-unsupported`  
**Contract PR first:** `contract/fallacies-unsupported`

| Step | Owner | Action |
|---|---|---|
| C2.1.1 | BE2 | Additive types: `unsupported?: boolean`, `fallacies?: FallacyTag[]` |
| C2.1.2 | BE2 | Implement `lib/fallacy/*`; prefer folding into extract prompt via BE1-reviewed prompt patch (minimal `prompt.ts` diff, BE1 reviewer) |
| C2.1.3 | BE1 | Approve prompt changes; keep JSON schema compatible |

### Task C2.2 — Visual flags  
**Owner: BE2** · Branch: `be2/fallacy-ui` · Reviewer: FE

| Step | Owner | Action |
|---|---|---|
| C2.2.1 | BE2 | `FallacyBadge.tsx` |
| C2.2.2 | BE2 | Soft unsupported ring/icon (not "false") |
| C2.2.3 | BE2 | PR against `DebateGraph.tsx` **only** adding optional render hooks / child components — keep diff surgical |
| C2.2.4 | FE | Review visual QA; request changes if graph perf regresses |

---

## Phase C3 — Animations + low-confidence speaker styling

### Task C3.1 — Entrance animation  
**Owner: BE2** · Branch: `be2/graph-anim` · Reviewer: FE

| Step | Owner | Action |
|---|---|---|
| C3.1.1 | BE2 | Animate new nodes (opacity/scale) on add; do not restart simulation harshly |
| C3.1.2 | BE2 | Subtle edge draw-in if cheap; skip if janky |

### Task C3.2 — Confidence styling  
**Owner: BE2** · Branch: `be2/speaker-confidence-ui` · Reviewer: FE

| Step | Owner | Action |
|---|---|---|
| C3.2.1 | BE2 | `SpeakerLabel.tsx`: if confidence < 0.55 → "Speaker A?" + muted opacity |
| C3.2.2 | FE | Use in Inspector + graph labels via mount PR |

---

## Phase C4 — Text fallback (mic failure)

### Task C4.1 — UI  
**Owner: FE** · Branch: `fe/text-fallback`

| Step | Owner | Action |
|---|---|---|
| C4.1.1 | FE | `TextFallbackInput`: textarea + submit injects into transcript buffer as a final chunk |
| C4.1.2 | FE | Same extraction loop consumes it — no special API |

### Task C4.2 — Polish / demo fail-safe  
**Owner: BE2** · Branch: `be2/fallback-help` · Reviewer: FE

| Step | Owner | Action |
|---|---|---|
| C4.2.1 | BE2 | Add keyboard shortcut hint / "Demo paste" that loads a rehearsal script fixture |
| C4.2.2 | FE | Mount in page |

**Gate C:** At least Summary + text fallback + confidence styling shipped on preview. Fallacies/animations best-effort.

---

# EPIC D — Demo hardening

**Goal:** Zero crashes; rehearsed script; known failure modes.

## Phase D1 — Rehearsal kit

| Step | Owner | Action |
|---|---|---|
| D1.1 | All | Write 60–90s debate script in `docs/DEMO_SCRIPT.md` (FE creates file, all edit via PR) |
| D1.2 | BE1 | Tune extract prompt against script until edges look right |
| D1.3 | BE2 | Tune speaker inference against same script |
| D1.4 | FE | Practice Start → talk → click inspector → summary on demo laptop |

## Phase D2 — Resilience

| Step | Owner | Action |
|---|---|---|
| D2.1 | FE | Guard all `window` access; no SSR crashes |
| D2.2 | BE1 | Rate-limit / single-flight extract on server if needed |
| D2.3 | BE2 | If speaker confidence always low, show hedging always rather than wrong certainty |
| D2.4 | BE1 | Logging: server logs latency ms (no transcript PII in Vercel if avoidable) |

## Phase D3 — Cut Could Haves ruthlessly

Only if Gates B5 + C (partial) are green and time remains — pick **one**:

| Option | Owner |
|---|---|
| Transcript sync | FE |
| Replay mode | BE2 |
| Steelman mode | BE1 (API) + BE2 (UI) |
| Post-hoc speaker relabel | FE (UI) + contract BE2 |

Default recommendation: **skip Could Haves** unless demo is already boring.

---

# EPIC E — Could Haves (optional backlog)

Do not schedule until D1 rehearsal passes. Keep as backlog tickets only.

| ID | Item | Owner if pulled |
|---|---|---|
| E1 | Transcript sync | FE |
| E2 | Replay mode | BE2 |
| E3 | Steelman Mode | BE1 API + BE2 UI |
| E4 | Assumption vs unsupported distinction | FE + BE2 |
| E5 | Topic clustering | BE1 |
| E6 | Post-hoc speaker relabel | FE |

---

## 6. Parallelization map (who works when)

```
Week/hackathon timeline (adjust to your window)
────────────────────────────────────────────────
Phase A0     FE: scaffold ────────┐
             BE1: env+types ──────┼── Gate A0
             BE2: read PRD/plan ──┘

Phase B1     FE: speech+UI ─────────────────────┐
Phase B2     BE1: gemini+extract ───────────────┼── Gate B2/B1
Phase B3     BE2: speaker infer (+ wire PR) ────┘

Phase B4     FE: loop+graph+inspector (uses B2; B3 if ready)
Phase B5     All: deploy Must

Phase C      BE2: summary/fallacy/anim/confidence UI
             FE: text fallback + mount BE2 components in page
             BE1: prompt tune + support BE2 prompt patches

Phase D      All: rehearsal + harden
```

**Maximum parallel no-conflict sets**

| Concurrent | Safe because |
|---|---|
| FE B1 + BE1 B2 + BE2 B3.1 | Different files |
| FE B4 + BE2 B3.2 | B3.2 only touches route under BE1 review |
| FE C4.1 + BE2 C1 + BE1 prompt tune | Different files |
| BE2 C1.2 + FE C4.1 | Different files; FE later mounts |

**Never parallel**

- Two people editing `lib/types/debate.ts`
- Two people editing `app/page.tsx`
- Two people editing `app/api/extract/route.ts`
- Two people adding deps to `package.json` without sequencing

---

## 7. Definition of Done (per PR)

- [ ] Only owns files for the role (or has required reviewer ack)
- [ ] Types match `lib/types/debate.ts`
- [ ] No secrets committed
- [ ] Manual test notes in PR body
- [ ] Rebased on `develop`
- [ ] Does not implement Won't Haves

---

## 8. Risk register & mitigations

| Risk | Owner | Mitigation |
|---|---|---|
| Extraction quality poor | BE1 | Fixtures + scripted rehearsal; iterate prompt early |
| Speaker misattribution on stage | BE2 + FE | Low-confidence styling; rehearse seating/voices; hedging copy |
| Graph SSR / window crash | FE | Dynamic import + client guards |
| API latency >5s | BE1 | One Gemini call; shrink prompt context; send claim summaries not full text |
| Mic fails live | FE + BE2 | Text fallback + demo paste script |
| Merge conflicts on page.tsx | FE | Only FE mounts; others ship components |
| Contract thrash | All | Additive-only after A0.3; Discord `#argus-contracts` |

---

## 9. Communication protocol (Discord)

When blocked on someone else's file:

1. Post in `#argus-contracts` or `#argus-be` / `#argus-fe` with: file path, why, proposed diff summary.
2. Owner responds within agreed SLA (suggest 2h during hackathon).
3. Owner either: (a) makes the change, or (b) invites a short paired PR.

Daily standup (15 min): each role answers — **done / next / blocked / gate status**.

---

## 10. Mapping: MoSCoW → owners summary

| Feature | Primary | Helper |
|---|---|---|
| Web Speech STT | FE | — |
| Auto speaker inference | BE2 | BE1 (route wire) |
| `/api/extract` + Gemini | BE1 | BE2 (speaker fields) |
| Live graph | FE | BE2 (anim/icons later) |
| Edge/node styling | FE | — |
| Claim Inspector | FE | BE2 (badges) |
| Vercel deploy | BE1 | FE smoke |
| Summary panel | BE2 | FE mount |
| Unsupported flag | BE2 | FE visual QA |
| Fallacy detection | BE2 | BE1 prompt |
| Animations | BE2 | FE review |
| Low-confidence styling | BE2 | FE mount |
| Text fallback | FE | BE2 demo paste |

---

## 11. First actions after reading this (today)

1. Assign humans to **FE / BE1 / BE2** in Discord.  
2. Copy the matching `.agents/*.agent.md` template locally (already gitignored).  
3. FE starts Task A0.1.  
4. BE1 starts Task A0.2 + A0.3 in parallel after scaffold lands (or types-only PR if folders exist).  
5. BE2 reviews PRD + this plan; prepares speaker prompt draft in a Google Doc/Discord paste (no code until A0).  

---

*End of implementation plan. Update via PR when gates slip or MoSCoW changes — keep PRD and this file synchronized.*
