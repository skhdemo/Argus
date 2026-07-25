# Product Requirements Document — Argus (Debate Reasoning Mapper)

> **Status:** Source of truth for product scope  
> **Audience:** FE, BE1, BE2 + hackathon judges  
> **Companion doc:** [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)  
> **Do not change MoSCoW without team agreement (Discord + PR).**

---

## 1. Overview

Argus is a web app that listens to a live, turn-by-turn debate between two speakers and uses Gemini to build a real-time visual graph of the argument's structure — claims, evidence, contradictions, and responses — as the conversation happens. Built for a hackathon demo; desktop web only, no auth, no persistence.

## 2. Problem Statement

Debates happen in real time, but the logical structure underneath — what's a claim, what's supported, what contradicts what — stays invisible, trapped in participants' heads. Argus surfaces that structure live, turning an audio conversation into a growing, legible graph.

## 3. Goals

- Demonstrate Gemini doing real structured reasoning extraction (not just chat) live on stage.
- Produce a "wow" moment: two people talk, a graph builds itself in real time — with zero manual input from the speakers.
- Ship a working demo within a single hackathon build window.

## 4. Non-Goals

- No multi-user/remote debate support (co-located, same-browser only).
- No persistence/database — state lives in-browser for the demo session.
- No mobile support.
- No fact-checking / truth verification of claims.
- No user accounts or auth.
- No manual speaker toggling — speaker attribution is inferred, not clicked/keyed by a human.

## 5. Users

Hackathon judges and audience (viewers of the demo); the two debate participants (just talk — no controls to operate).

## 6. Core User Flow

1. Two speakers open the app on one desktop browser and hit **Start**.
2. They simply talk — no seat-click, no spacebar, no manual speaker assignment.
3. Audio is transcribed continuously; speaker turns are inferred automatically (via diarization/segmentation — see §7) rather than set by a person.
4. Transcribed chunks are periodically sent to `/api/extract` with inferred speaker label + existing claims as context.
5. Gemini returns structured JSON: new claims, evidence, and edges (`supports` / `contradicts` / `responds_to`).
6. The graph animates new nodes/edges into place live.
7. Clicking a node opens the Claim Inspector with detail (speaker, text, type, linked evidence).
8. At any point, a summary view can be generated (claim count, unsupported count, contested points).

## 7. Technical Approach (as scoped)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Backend | Primary API: `app/api/extract/route.ts` (+ optional `app/api/summary/route.ts`) |
| Model | Gemini 3+ (latest available Gemini 3-series model) via `@google/genai` — **all** AI work |
| Speaker detection | No manual toggle. Inferred each extraction cycle — diarization signal if available, else Gemini turn inference from transcript |
| Graph | `react-force-graph-2d` (preferred) or `d3-force` + SVG |
| Voice | MediaRecorder (browser mic) → Gemini audio STT + speaker diarization via `/api/transcribe` |
| Styling | Tailwind CSS |
| Deploy | Vercel |

No database; all state client-side for the length of the demo.

### Target file layout

```
app/
  page.tsx                    # FE: session glue, wiring
  layout.tsx                  # FE: root layout
  globals.css                 # FE: design tokens
  api/extract/route.ts        # BE1: Gemini extraction
  api/summary/route.ts        # BE2: end-of-debate summary (Should Have)
components/
  DebateGraph.tsx             # FE basic → BE2 polish (animations)
  ClaimInspector.tsx          # FE
  TranscriptPanel.tsx         # FE
  SummaryPanel.tsx            # BE2 (Should Have UI)
  TextFallbackInput.tsx       # FE shell → BE2 wiring help
  StartControls.tsx           # FE
lib/
  types/debate.ts             # BE1 owns contract; others consume
  gemini/client.ts            # BE1
  extract/                    # BE1
  speaker/                    # BE2
  summary/                    # BE2
  fallacy/                    # BE2
hooks/
  useSpeechRecognition.ts     # FE
  useDebateSession.ts         # FE
  useExtractionLoop.ts        # FE (calls API; BE1 defines request/response)
```

`SpeakerSeats.tsx` is **intentionally absent** — no manual turn control.

### Known gotchas

- `react-force-graph` touches `window` → dynamic import with `ssr: false`.
- MediaRecorder is browser-only → `'use client'` + guard `navigator.mediaDevices.getUserMedia`.
- Gemini STT adds latency (~chunk length + model time); tune chunk size for demo cadence.
- Automatic speaker inference is less reliable than a manual toggle — show confidence hedging in UI (e.g. "Speaker A?" + lower opacity) so misattribution doesn't look like a stage bug.
- Extraction prompt quality + speaker attribution are the two make-or-break hard problems. Budget real time for both.

### Risk callout

The extraction prompt (claim / contradiction / evidence detection) remains make-or-break — compounded by automatic speaker attribution. Rehearse a 60–90s scripted debate before demo day.

## 8. Success Metrics (demo context)

- Graph visibly updates within ~2–5s of a spoken claim.
- Speaker attribution correct on the large majority of turns in a rehearsed 60–90s debate.
- Claims, evidence-linking, and contradiction-linking work reliably.
- Zero crashes during the live demo window.

---

## 9. Features — MoSCoW

### Must Have

- Continuous mic capture via MediaRecorder → Gemini `/api/transcribe` (STT + speaker diarization), no manual speaker controls.
- Automatic speaker/turn inference (no click/keypress toggle).
- `/api/extract` calling Gemini 3+ with `{ text, inferred_speaker, existing_claims }`, returning structured JSON (claims, evidence, edges).
- Live force-directed graph rendering nodes as they're extracted.
- Edge types: `supports`, `contradicts`, `responds_to` — distinct stroke styles.
- Node color coding: green = supported, yellow = assumption, red = needs evidence, blue = counterargument.
- Basic Claim Inspector: click node → claim text, inferred speaker, type.
- Deployed, working build on Vercel for demo day.

### Should Have

- End-of-debate summary panel (claim count, evidence count, unsupported count, most contested point) via Gemini 3+.
- Visual "unsupported claim" flagging (soft warning, not verdict).
- Basic fallacy detection (ad hominem, strawman, circular reasoning, false dilemma) with small warning icon on node.
- Smooth node/edge entrance animation.
- Low-confidence speaker label styling.
- Manual text-input fallback if mic/speech recognition fails live.

### Could Have

- Live transcript sync — click node → scroll/highlight originating sentence.
- Replay mode — animate full graph build from t=0 after debate ends.
- Steelman Mode — Gemini suggests strongest opposing argument.
- Assumption node highlighting distinct from unsupported-claim styling.
- Topic tagging / auto-clustering by subtopic.
- Post-hoc speaker re-labeling (correct auto-inference mistakes).

### Won't Have (this build)

- Persistence / database / saved debate history.
- Multi-room or remote debate support.
- Mobile-responsive layout.
- User accounts, auth, or multi-debate library.
- Automated fact-checking / truth-labeling.
- Any manual speaker/turn control (seat click, spacebar, or otherwise).

---

## 10. Team roles (product view)

| Role code | Focus | Helps FE when? |
|---|---|---|
| **FE** | All basic UI, speech capture client, graph shell, inspector, session state | Owns frontend forever for Must Have basics |
| **BE1** | Gemini client, `/api/extract`, schemas, claim/edge prompts | After Must API is stable — may pair on `useExtractionLoop` contract only |
| **BE2** | Speaker inference, summary API, fallacy detection | After own Must/Should backend lands — owns advanced FE (SummaryPanel, animations, fallacy icons, confidence styling) |

See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for file ownership and branch rules.

---

## TL;DR

Speaker toggle is gone — attribution is automatic each extraction cycle. All AI on **Gemini 3+**. Must = STT + auto speaker + extract API + live graph + colors/edges + inspector + Vercel. Should = summary, unsupported flags, fallacies, animations, low-confidence styling, text fallback. Won't = persistence, remote, mobile, auth, fact-check, manual turn control.
