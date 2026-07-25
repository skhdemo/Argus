# Frontend Handoff — Claim–Evidence V2

> **Audience:** FE integrating against `be1/claim-evidence-v2`  
> **Contract source:** [`lib/types/debate.ts`](../lib/types/debate.ts)  
> **Scoring:** [`DEBATE_SCORING.md`](./DEBATE_SCORING.md)  
> **Branch:** `be1/claim-evidence-v2` (not yet merged to `develop`)

This document is the FE migration bible. Backend intentionally left FE compile broken until you adapt.

---

## 1. Mental model

| Entity | Role in UI |
|---|---|
| **Claim** | The **only** force-graph node. Nature = `argument` \| `counterargument`. |
| **Evidence** | Speaker-provided justification. **Never** a graph node. Shown in inspector / as a badge count on the claim. |
| **Relation** | Claim→claim link only: `counters` \| `responds_to`. |

Two distinct support axes:

1. **Speaker support** (did they offer evidence?) — derived: `unsupported` \| `evidence_provided`
2. **External corroboration** (do web sources align?) — stored on `Evidence.verification`, never a claim true/false label

**Display status** (inspector / node color) is derived from attached evidence verification + relevance. Helpers live in `lib/debate/status.ts` — FE may import them or re-derive identically.

### Messi regression (acceptance)

> “Messi is better because he won a World Cup and two Copa Américas”

Must render as **one claim node** + **one attached evidence** item. Never two claim nodes.

---

## 2. Endpoint catalog

### `POST /api/transcribe` — unchanged

Gemini audio STT + diarization. No contract change in v2.

### `POST /api/extract` — breaking

**Request**

```json
{
  "text": "Messi is better because he won a World Cup and two Copa Américas",
  "transcriptWindow": "optional recent context",
  "inferredSpeaker": "A",
  "pauseMs": 1200,
  "existingClaims": [],
  "existingEvidence": [],
  "existingRelations": []
}
```

**Response (deltas only)**

```json
{
  "claims": [
    {
      "id": "c_abc",
      "text": "Messi is better",
      "speaker": "A",
      "speakerConfidence": 0.8,
      "nature": "argument",
      "createdAt": 1710000000000
    }
  ],
  "evidence": [
    {
      "id": "ev_xyz",
      "text": "he won a World Cup and two Copa Américas",
      "speaker": "A",
      "supportsClaimIds": ["c_abc"],
      "kind": "factual_claim",
      "verification": {
        "status": "pending",
        "relevance": "pending",
        "sources": []
      },
      "createdAt": 1710000000000
    }
  ],
  "relations": [],
  "inferredSpeaker": "A",
  "speakerConfidence": 0.8,
  "notes": "optional"
}
```

Removed vs v1: `claims[].type`, `claims[].unsupported`, `edges[]`, `supports` / `contradicts` edge types, `existingEdges`.

### `POST /api/verify-evidence` — new

Async. Never block the extract/graph path.

**Request**

```json
{
  "evidence": { "...full Evidence object..." },
  "claim": { "...primary Claim for relevance..." },
  "force": false
}
```

**Response (HTTP 200 for not_verifiable / inconclusive too)**

```json
{
  "evidenceId": "ev_xyz",
  "verification": {
    "status": "corroborated",
    "relevance": "strong",
    "confidence": 0.82,
    "summary": "Sources align with the speaker-provided statistic.",
    "sources": [{ "uri": "https://...", "title": "...", "domain": "..." }],
    "webSearchQueries": ["..."],
    "checkedAt": 1710000005000
  },
  "displayStatusHint": "supported"
}
```

**Error codes** (`ApiErrorBody.code`): `BAD_REQUEST`, `MISSING_KEY`, `UPSTREAM`, `PARSE`, `RATE_LIMIT` (429), `TIMEOUT` (504), `BLOCKED` (403), `VERIFY_DISABLED` (503).

Env: `ARGUS_VERIFY_ENABLED` (default enabled unless `false`), `ARGUS_VERIFY_CONCURRENCY=1`, optional `GEMINI_VERIFY_MODEL`.

### `POST /api/score` — breaking

**Request:** `{ claims, evidence, relations }`  
**Response:** `DebateScoreSnapshot` (`scoreA`/`scoreB` sum to 100, `leader`, `isDecisive`, …).  
Optional `?debug=1` for breakdown fields. **No API key.**

### `POST /api/summary` — breaking

**Request:** `{ claims, evidence, relations }`  
**Response:** stats (`claimCount`, `evidenceCount`, `unsupportedCount`, verification tallies, `mostContestedClaimId`) + `narrative` + **required** `debateScore`.  
If Gemini narrative fails, stats + score still return with a fallback narrative.

---

## 3. Frontend state shape

Replace edge-centric state with:

```ts
claims: Claim[];
evidence: Evidence[];
relations: Relation[];
selectedClaimId: string | null;
verifyQueue: Map<string /* evidenceId */, "idle" | "queued" | "running" | "error">;
lastScore: DebateScoreSnapshot | null;
```

---

## 4. Merge semantics

- Merge claims / evidence / relations **by `id`**.
- Replace `verification` by evidence id when `/api/verify-evidence` returns.
- Ignore orphan evidence (no resolvable `supportsClaimIds`) and invalid relation endpoints.
- Never select or render an Evidence id as a force-graph node or link endpoint.
- Relation endpoints are always Claim ids (`c_…`).

---

## 5. Required frontend file changes

Backend will **not** edit these. FE owns:

| File | Work |
|---|---|
| `hooks/useDebateSession.ts` | Hold `claims` / `evidence` / `relations`; merge deltas |
| `hooks/useExtractionLoop.ts` | Send `existingEvidence` + `existingRelations`; consume new response |
| `hooks/useMomentum.ts` | Drive from `/api/score` or shared `computeDebateScore`; keep `MomentumState` shape; decisive threshold `0.62` |
| `components/DebateGraph.tsx` | Nodes from Claims only; relation strokes for `counters` / `responds_to`; evidence badge optional |
| `components/ClaimInspector.tsx` | Nature, display status, attached evidence + sources + verification |
| `components/MomentumBackdrop.tsx` | Consume score v2 snapshot |
| `app/page.tsx` | Wire verify queue; stop treating edges as support |
| `app/globals.css` | Colors for display statuses / relation strokes (no evidence-as-green-node) |

Also update any local fixtures/mocks that still use `type: needs_evidence` or `supports` edges.

---

## 6. Graph design guidance

- Nodes map **only** from Claims.
- Claim **nature** controls role labeling (argument vs counterargument), not support color.
- Support / corroboration coloring uses **derived display status**:
  - `unsupported`
  - `pending_confirmation`
  - `supported`
  - `weak_support`
  - `contested_evidence`
  - `not_externally_verifiable`
- Evidence count may appear as a node badge.
- Evidence details, sources, relevance, verification belong in Claim Inspector.
- Relations: distinct counter vs response stroke styles.
- Remove Evidence-as-green-node / `supports` edge behavior.

---

## 7. Verification orchestration

1. After extract, enqueue each new Evidence with `verification.status === "pending"`.
2. Global concurrency **one** (server also has an in-process lock; serverless is not a global lock — FE must serialize).
3. Single-flight per evidence id.
4. Never block graph updates on verify.
5. Retry `429` with backoff; keep last verification on other errors and expose Retry.
6. Anecdotes / reasoning short-circuit to `not_verifiable` without Search (HTTP 200).

Language in UI: prefer “sources corroborate / contest / pending confirmation / not externally verifiable.”  
Never: “this claim is true/false.”

---

## 8. Momentum integration

- Replace placeholder arithmetic with `POST /api/score` (or import `computeDebateScore` after merge if you prefer client-side).
- Keep existing `MomentumState` shape if possible.
- Align decisive threshold to backend `DECISIVE_LEADER_SHARE = 0.62`.
- Keep last good score on score errors.

---

## 9. Integration order

1. Pull `be1/claim-evidence-v2` types (`lib/types/debate.ts`)
2. Update session state + merge
3. Update extraction request/response
4. Update fixtures / mocks
5. Render Claim-only graph
6. Add Evidence inspector + badge
7. Add verify queue
8. Switch momentum to score v2
9. Update summary UI
10. QA errors / loading / demo script (Messi + counter)

---

## 10. FE acceptance checklist

- [ ] Messi example renders **one** node
- [ ] Evidence appears under that node (inspector / badge)
- [ ] Pending / corroborated / contested states render distinctly
- [ ] No Evidence id appears in graph links
- [ ] Counterarguments target visible Claims via `counters` / `responds_to`
- [ ] Momentum matches `/api/score`
- [ ] Summary shows real evidence counts + verification tallies
- [ ] Verify failures do not freeze the live graph

---

## 11. Expected compile blockers (until FE adapts)

These are intentional — do not ask backend to restore v1 fields:

- `Claim.type` / `Claim.unsupported` removed
- `Edge` / `existingEdges` / `supports` / `contradicts` removed
- Extract/Summary/Score request bodies require `evidence` + `relations`
- Graph code that maps “evidence claims” to green nodes will fail typecheck
- Any import of old `ClaimType` / `EdgeType` from `@/lib/types/debate`

Backend validation commands (green on this branch):

```bash
npm run test:backend
npm run typecheck:backend
npm run lint
```
