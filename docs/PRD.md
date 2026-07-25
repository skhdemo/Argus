# Product Requirements Document — Argus (Debate Reasoning Mapper)

> **Status:** Source of truth for product scope (v2 claim–evidence ontology)  
> **Audience:** FE + full backend owner + hackathon judges  
> **Companion docs:** [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md), [`DEBATE_SCORING.md`](./DEBATE_SCORING.md), [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md)  
> **Do not change MoSCoW without team agreement (Discord + PR).**

---

## 1. Overview

Argus is a web app that listens to a live, turn-by-turn debate between two speakers and uses Gemini to build a real-time visual graph of the argument's structure — **claims as nodes**, **speaker-provided evidence as attached non-node entities**, and claim-to-claim counters/responses — as the conversation happens. Built for a hackathon demo; desktop web only, no auth, no persistence.

## 2. Problem Statement

Debates happen in real time, but the logical structure underneath — what's a claim, what evidence was offered, what contradicts what — stays invisible, trapped in participants' heads. Argus surfaces that structure live, turning an audio conversation into a growing, legible graph.

## 3. Goals

- Demonstrate Gemini doing real structured reasoning extraction (not just chat) live on stage.
- Produce a "wow" moment: two people talk, a graph builds itself in real time — with zero manual input from the speakers.
- Keep **claims** and **evidence** ontologically separate so "Messi is better because he won X" becomes one claim node + one attached evidence item, not two claim nodes.
- Ship a working demo within a single hackathon build window.

## 4. Non-Goals

- No multi-user/remote debate support (co-located, same-browser only).
- No persistence/database — state lives in-browser for the demo session.
- No mobile support.
- No claim-level truth labels (`true` / `false` / "incorrect"). Speaker-provided evidence **may** receive async **source corroboration** via Gemini + Google Search (status: corroborated / contested / inconclusive / not_verifiable) — that is not the same as labeling a claim true or false.
- No user accounts or auth.
- No manual speaker toggling — speaker attribution is inferred, not clicked/keyed by a human.

## 5. Users

Hackathon judges and audience (viewers of the demo); the two debate participants (just talk — no controls to operate).

## 6. Core User Flow

1. Two speakers open the app on one desktop browser and hit **Start**.
2. They simply talk — no seat-click, no spacebar, no manual speaker assignment.
3. Audio is transcribed continuously; speaker turns are inferred automatically (via Gemini audio STT + diarization — see §7).
4. Transcribed chunks are periodically sent to `/api/extract` with inferred speaker label + existing claims/evidence/relations as context.
5. Gemini returns structured JSON:
   - new/updated **claims** (nature: `argument` | `counterargument`)
   - new/updated **evidence** (non-node; supports one or more claim IDs)
   - new **relations** (`counters` | `responds_to` between claims only)
6. The graph animates **claim nodes** and claim–claim relations live. Evidence attaches to claims (inspector / badge), never as force-graph nodes.
7. Pending evidence is verified asynchronously via `/api/verify-evidence` (Gemini + Google Search grounding). Verification updates the evidence entity only.
8. Clicking a claim node opens the Claim Inspector (speaker, nature, display support status, attached evidence + sources, linked claims, fallacies).
9. At any point, a summary view can be generated (claim count, evidence count, unsupported count, verification tallies, contested points, debate score).

## 7. Technical Approach (as scoped)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Backend | `/api/transcribe`, `/api/extract`, `/api/verify-evidence`, `/api/score`, `/api/summary` |
| Model | Gemini 3+ via `@google/genai` — **all** AI work |
| Ontology | Claims = graph nodes; Evidence = first-class non-nodes; Relations = claim↔claim only |
| Speaker detection | Automatic each cycle (Gemini audio diarization + extract-time inference) |
| Evidence verify | Async Google Search grounding; never on the extract hot path |
| Graph | `react-force-graph-2d` (preferred) or `d3-force` + SVG — **claims only** |
| Voice | MediaRecorder → Gemini `/api/transcribe` |
| Scoring | Deterministic graph math (`lib/score`) — no Gemini |
| Styling | Tailwind CSS |
| Deploy | Vercel |

No database; all state client-side for the length of the demo.

### Ontology (v2)

| Entity | Role |
|---|---|
| **Claim** | Debatable conclusion. Nature = `argument` \| `counterargument`. Graph node. |
| **Evidence** | Speaker-provided justification for a claim. Never a graph node. Carries verification status. |
| **Relation** | Claim→claim link: `counters` or `responds_to`. |

**Speaker support** (did they offer evidence?) is derived: `unsupported` \| `evidence_provided`.  
**Display status** (UI) is derived from attached evidence verification/relevance (e.g. `pending_confirmation`, `supported`, `contested_evidence`).

### Target file layout

```
app/
  page.tsx                    # FE: session glue, wiring
  layout.tsx                  # FE: root layout
  globals.css                 # FE: design tokens
  api/transcribe/route.ts     # Backend: Gemini audio STT + diarization
  api/extract/route.ts        # Backend: claims + evidence + relations
  api/verify-evidence/route.ts# Backend: async Google Search corroboration
  api/score/route.ts          # Backend: deterministic debate score
  api/summary/route.ts        # Backend: summary + score snapshot
components/                   # FE-owned
lib/
  types/debate.ts             # Shared contract (backend owns)
  gemini/                     # Gemini client + model pin
  extract/                    # Extract prompt/schema/merge
  debate/status.ts            # Derived support + display status
  verify/                     # Google Search corroboration
  score/                      # Deterministic scoring
  speaker/                    # Turn/speaker inference
  summary/                    # Summary stats/prompts
  fallacy/                    # Soft fallacy tags
hooks/                        # FE-owned
docs/
  FRONTEND_HANDOFF.md         # FE migration bible for v2 contract
```

### Known gotchas

- `react-force-graph` touches `window` → dynamic import with `ssr: false`.
- MediaRecorder is browser-only → `'use client'` + guard `navigator.mediaDevices.getUserMedia`.
- Gemini STT adds latency (~chunk length + model time); tune chunk size for demo cadence.
- Automatic speaker inference is less reliable than a manual toggle — show confidence hedging in UI.
- Evidence must never be rendered as graph nodes; doing so recreates the Messi double-node bug.
- Google Search + JSON schema on one call can silently drop grounding chunks — verify uses a two-pass design.
- Extraction prompt quality + speaker attribution + claim/evidence separation are the make-or-break hard problems.

### Risk callout

Rehearse a 60–90s scripted debate before demo day. Prefer "sources corroborate / contest" language — never "this claim is true/false."

## 8. Success Metrics (demo context)

- Graph visibly updates within ~2–5s of a spoken claim.
- Speaker attribution correct on the large majority of turns in a rehearsed 60–90s debate.
- Claim/evidence separation works: justification text becomes Evidence, not a second Claim node.
- Contradiction linking (`counters`) and response linking (`responds_to`) work reliably.
- Async evidence corroboration updates inspector without blocking the live graph.
- Zero crashes during the live demo window.

---

## 9. Features — MoSCoW

### Must Have

- Continuous mic capture via MediaRecorder → Gemini `/api/transcribe` (STT + speaker diarization), no manual speaker controls.
- Automatic speaker/turn inference (no click/keypress toggle).
- `/api/extract` returning **claims**, **evidence**, and claim–claim **relations** (`counters` / `responds_to`).
- Live force-directed graph rendering **claim nodes only** as they're extracted.
- Evidence attached to claims (inspector / badge count) — never as graph nodes.
- Relation stroke styles for `counters` and `responds_to`.
- Node / badge coding driven by claim **nature** + derived **display support status** (not the old overloaded ClaimType enum).
- Basic Claim Inspector: claim text, inferred speaker, nature, attached evidence, linked claims.
- Deployed, working build on Vercel for demo day.

### Should Have

- Async `/api/verify-evidence` with Gemini + Google Search grounding (corroborated / contested / inconclusive / not_verifiable).
- End-of-debate summary panel (claim count, evidence count, unsupported count, verification tallies, most contested point, debate score).
- Deterministic debate score (`/api/score`) consuming claims + evidence + relations.
- Soft unsupported / pending-confirmation flagging (not a truth verdict).
- Basic fallacy detection (ad hominem, strawman, circular reasoning, false dilemma) with a small warning icon on the claim node.
- Smooth node/edge entrance animation.
- Low-confidence speaker label styling.
- Manual text-input fallback if mic/speech recognition fails live.

### Could Have

- Live transcript sync — click claim → scroll/highlight originating sentence.
- Replay mode — animate the full graph build from t=0 after the debate ends.
- Steelman Mode — Gemini suggests the strongest version of an opposing argument.
- Topic tagging / auto-clustering of claims by subtopic.
- Post-hoc speaker re-labeling (correct auto-inference mistakes).
- Soft score influence from corroboration (beyond provisional pending weights).

### Won't Have (this build)

- Persistence / database / saved debate history.
- Multi-room or remote debate support.
- Mobile-responsive layout.
- User accounts, auth, or multi-debate library.
- Claim-level automated truth labels (`true` / `false`).
- Any manual speaker/turn control (seat click, spacebar, or otherwise).

---

## 10. Team roles (product view)

| Role | Focus |
|---|---|
| **FE** | UI, speech capture client, graph shell, inspector, session state, verify queue UX |
| **Backend (full)** | All AI routes, contracts, extract/verify/score/summary, speaker inference, fallacy soft tags, docs |

See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) and [`FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md).

---

## TL;DR

Speaker toggle is gone — attribution is automatic. All AI on **Gemini 3+**. Graph nodes = **claims only**; **evidence** is attached and may be asynchronously corroborated via Google Search (never claim truth labels). Must = STT + auto speaker + extract (claims/evidence/relations) + live claim graph + inspector + Vercel. Should = verify-evidence, summary, score, unsupported/pending flags, fallacies, animations, text fallback. Won't = persistence, remote, mobile, auth, claim true/false labels, manual turn control.
