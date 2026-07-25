# Debate scoring formula (claim–evidence v2)

Implementation: [`lib/score/debateScore.ts`](../lib/score/debateScore.ts)  
Derived status: [`lib/debate/status.ts`](../lib/debate/status.ts)  
API: `POST /api/score` (no Gemini) · also embedded on `POST /api/summary` as `debateScore`  
Tests: [`lib/score/debateScore.test.ts`](../lib/score/debateScore.test.ts)

## What "winning" means

Argus scores **argument structure + speaker-provided evidence quality signals**, not claim true/false.

A speaker is ahead when their graph shows:

- more Claims with attached Evidence (especially corroborated + relevant)
- stronger counter / response moves
- fewer unsupported or fallacious Claims

Speaker labels come from **Gemini audio diarization → extract** (`claim.speaker` ∈ `A` | `B`). Claims with `UNKNOWN` contribute **0**. Evidence contribution is credited to the **Claim speaker** after splitting across `supportsClaimIds`.

This is **deterministic graph math**. No Gemini call is used for the numeric score.

---

## Pipeline

```text
Mic audio
  → POST /api/transcribe (Gemini STT + diarization)
  → POST /api/extract (claims + evidence + relations)
  → optional POST /api/verify-evidence (updates Evidence.verification)
  → computeDebateScore(claims, evidence, relations)
  → rawA/rawB → ratioA/ratioB → scoreA/scoreB (0–100)
```

---

## Notation

| Symbol | Meaning |
|---|---|
| \(c\) | A Claim node |
| \(v\) | An Evidence item (never a node) |
| \(r\) | A Relation (`counters` \| `responds_to`) |
| \(B(c)\) | Base points by Claim nature |
| \(V(v)\) | Evidence unit before split |
| \(E(c)\) | Clamped Evidence contribution on Claim |
| \(P(c)\) | Soft penalties (unsupported + fallacies) |
| \(R(r)\) | Relation credit (+ rebuttal) |
| \(\mathrm{Raw}_A, \mathrm{Raw}_B\) | Speaker totals before normalization |

---

## 1. Claim nature base \(B(c)\)

| `claim.nature` | \(B(c)\) |
|---|---|
| `argument` | **+1** |
| `counterargument` | **+1** |

Nature is rhetorical role only. Support is **not** a Claim type.  
Counterargument does **not** get an extra attack bonus — attack credit comes only from Relations.

Constants: `CLAIM_NATURE_BASE` in `lib/score/constants.ts`.

---

## 2. Evidence contribution

For each Evidence item \(v\):

\[
V(v) = w_{\text{ver}}(v) \cdot w_{\text{rel}}(v) \cdot 1.5
\]

### Verification weights \(w_{\text{ver}}\)

| `verification.status` | Weight |
|---|---|
| `pending` | **+0.25** |
| `corroborated` | **+1.0** |
| `contested` | **−0.5** |
| `inconclusive` | **+0.15** |
| `not_verifiable` | **+0.20** |
| `error` | **+0.25** (infra failure must not punish the speaker) |

### Relevance weights \(w_{\text{rel}}\)

| `verification.relevance` | Weight |
|---|---|
| `pending` | **0.50** |
| `strong` | **1.0** |
| `moderate` | **0.70** |
| `weak` | **0.30** |
| `irrelevant` | **0** |

### Split across targets

\(V(v)\) is split **evenly** across `supportsClaimIds` so one citation cannot multiply by targeting many Claims.

### Cap per Claim

Sum of Evidence shares on Claim \(c\) is clamped to:

- positive cap **+3**
- negative floor **−1.5**

That clamped sum is \(E(c)\).

---

## 3. Soft penalties \(P(c)\)

| Condition | Penalty |
|---|---|
| No Evidence references \(c\) (`unsupported`) | **−1.5** once |
| Each entry in `fallacies[]` | **−1** each, **capped at −3** |

\[
S_{\text{claim}}(c) = B(c) + E(c) + P(c)
\]

Sum into \(\mathrm{Raw}_A\) / \(\mathrm{Raw}_B\) by `claim.speaker`.

---

## 4. Relation credits \(R(r)\)

Credit the **speaker of the Claim at `relation.from`**:

| `relation.type` | Credit |
|---|---|
| `counters` | **+2** |
| `responds_to` | **+1** |

**Rebuttal bonus (+1)** when the target Claim’s speaker is the opponent **and** that target is `unsupported` (no attached Evidence).

**Undercut (−1)** on the target’s speaker for each `counters` Relation against an unsupported opponent Claim.

---

## 5. Normalization → UI ratios and 0–100 scores

\[
\begin{align*}
\text{floor} &= \min(\mathrm{Raw}_A, \mathrm{Raw}_B, 0) \\
m_A &= \mathrm{Raw}_A - \text{floor} \\
m_B &= \mathrm{Raw}_B - \text{floor} \\
T &= m_A + m_B
\end{align*}
\]

If \(T = 0\): tie → `ratioA = ratioB = 0.5`, `scoreA = scoreB = 50`.

Otherwise:

\[
\begin{align*}
\mathrm{ratioA} &= m_A / T \\
\mathrm{ratioB} &= 1 - \mathrm{ratioA} \\
\mathrm{scoreA} &= \mathrm{round}(100 \cdot \mathrm{ratioA}) \\
\mathrm{scoreB} &= 100 - \mathrm{scoreA}
\end{align*}
\]

- `leader` = `A` | `B` | `tied`
- `leaderShare` = \(\max(\mathrm{ratioA}, \mathrm{ratioB})\)
- `isDecisive` iff leader ≠ tied **and** `leaderShare ≥ 0.62`

---

## Worked proof — Messi (claim ≠ evidence)

Transcript: “Messi is better because he won a World Cup and two Copa Américas.”

Graph (correct extract):

1. Claim `c_messi` speaker **A**, `nature: argument` — “Messi is better”
2. Evidence `ev_messi` → supports `[c_messi]`, `kind: factual_claim`
3. `verification.status = pending`, `relevance = pending`
4. Relations: none

**No second Claim** for the trophy justification.

| Piece | Math |
|---|---|
| Claim base | \(B = +1\) |
| Evidence unit | \(0.25 \times 0.50 \times 1.5 = 0.1875\) |
| Unsupported? | no (Evidence attached) → \(0\) |
| Claim total | \(1 + 0.1875 = 1.1875\) → A |

\[
\mathrm{Raw}_A = 1.1875,\quad \mathrm{Raw}_B = 0
\Rightarrow \mathrm{scoreA}=100,\ \mathrm{scoreB}=0,\ \mathrm{leader}=A
\]

After async verify becomes `corroborated` + `strong`:

\[
E = 1.0 \times 1.0 \times 1.5 = 1.5,\quad S = 2.5
\]

Verified by unit tests `Messi worked example`.

---

## Worked proof — counters + unsupported undercut

1. `cA` speaker A, argument, no Evidence → unsupported  
2. `cB` speaker B, counterargument  
3. `r`: `cB -counters-> cA`

| Piece | Value |
|---|---|
| cA | \(1 - 1.5 = -0.5\) |
| cB | \(1 - 1.5 = -0.5\) (also unsupported) |
| Relation counters | \(+2\) + rebuttal \(+1\) = **+3** → B |
| Undercut on cA | **−1** → A |

\[
\mathrm{Raw}_A = -0.5 - 1 = -1.5,\quad \mathrm{Raw}_B = -0.5 + 3 = 2.5
\]

---

## Derived display status (not scored directly)

`deriveClaimDisplayStatus` (see `lib/debate/status.ts`) maps attached Evidence to UI labels. Precedence when mixed:

1. no Evidence → `unsupported`
2. corroborated + strong/moderate → `supported`
3. contested (no relevant corroboration) → `contested_evidence`
4. corroborated + weak/irrelevant → `weak_support`
5. pending / inconclusive / error → `pending_confirmation`
6. only `not_verifiable` → `not_externally_verifiable`

---

## API

### `POST /api/score`

```json
{ "claims": [...], "evidence": [...], "relations": [...] }
```

Returns `DebateScoreSnapshot` plus `undercutA` / `undercutB`.  
Add `?debug=1` for claim/evidence/relation breakdowns.  
No API key required. Oversized demo payloads are rejected.

### `GET /api/score`

Health: `deterministic score v2`.

---

## Invariants (enforced by tests)

1. `scoreA + scoreB === 100` always.
2. UNKNOWN speakers never change raw scores.
3. Swapping all A↔B speakers swaps rawA↔rawB and mirrors ratios.
4. Evidence is never scored as a Claim node.
5. One Evidence item’s total contribution does not multiply by target count.
6. Irrelevant corroborated Evidence contributes \(0\).
7. Unsupported penalty applies at most once per Claim.
8. Fallacy penalty capped at −3.
9. Counterargument nature does not double-count attack credit.

---

## File map

| Path | Role |
|---|---|
| `lib/score/constants.ts` | Tunable weights |
| `lib/score/debateScore.ts` | Formula implementation |
| `lib/score/index.ts` | Public exports |
| `lib/score/debateScore.test.ts` | Unit proofs |
| `lib/debate/status.ts` | Support / display derivation |
| `app/api/score/route.ts` | HTTP surface |
| `docs/DEBATE_SCORING.md` | This document |
