# Debate scoring formula

Implementation: [`lib/score/debateScore.ts`](../lib/score/debateScore.ts)  
API: `POST /api/score` (no Gemini) · also embedded on `POST /api/summary` as `debateScore`  
Tests: [`lib/score/debateScore.test.ts`](../lib/score/debateScore.test.ts)

## What "winning" means

Argus scores **argument structure**, not factual truth.

A speaker is ahead when their Gemini-labeled claims and edges show:

- more well-supported positions
- stronger attack / engage moves
- fewer unsupported or fallacious points

Speaker labels come from **Gemini audio diarization → extract** (`claim.speaker` ∈ `A` | `B`). Claims with `UNKNOWN` contribute **0**.

This is **deterministic graph math**. No Gemini call is used for the numeric score (keeps the live loop fast and stable).

---

## Pipeline

```text
Mic audio
  → POST /api/transcribe (Gemini STT + diarization)
  → transcript segments with speaker A/B
  → POST /api/extract (Gemini structure)
  → claims[] + edges[]  (each claim has speaker)
  → computeDebateScore(claims, edges)   ← this doc
  → rawA/rawB → ratioA/ratioB → scoreA/scoreB (0–100)
```

Frontend currently still uses a placeholder in `hooks/useMomentum.ts`.  
Backend truth lives in `lib/score/*` and `POST /api/score`. FE can switch later by importing the lib or calling the API.

---

## Notation

| Symbol | Meaning |
|---|---|
| \(c\) | A claim node |
| \(e\) | An edge (`from` → `to`) |
| \(B(c)\) | Base points by claim type |
| \(P(c)\) | Soft penalties (≤ 0) |
| \(S_{\text{claim}}(c)\) | \(B(c) + P(c)\) |
| \(E(e)\) | Edge credit to speaker of `from` |
| \(\mathrm{Raw}_A, \mathrm{Raw}_B\) | Speaker totals before normalization |

---

## 1. Claim base \(B(c)\)

| `claim.type` | \(B(c)\) |
|---|---|
| `supported` | **+3** |
| `counterargument` | **+2** |
| `assumption` | **+0.5** |
| `needs_evidence` | **−1** |

Constants: `CLAIM_BASE` in `lib/score/constants.ts`.

---

## 2. Soft penalties \(P(c)\) (subtract)

Let \(P(c) \le 0\).

| Condition | Penalty |
|---|---|
| `unsupported === true` | **−1.5** |
| `type === needs_evidence` **and** no inbound `supports` edge | **−1** |
| Each entry in `fallacies[]` | **−1** each, **capped at −3** |

\[
S_{\text{claim}}(c) = B(c) + P(c)
\]

Sum \(S_{\text{claim}}\) into \(\mathrm{Raw}_A\) or \(\mathrm{Raw}_B\) by `claim.speaker`.

---

## 3. Edge credits \(E(e)\)

Credit the **speaker of the claim at `edge.from`** (the person making the move):

| `edge.type` | Credit |
|---|---|
| `supports` | **+2** |
| `contradicts` | **+2.5** |
| `responds_to` | **+1** |

**Rebuttal bonus (+1)** when:

- edge is `contradicts` or `responds_to`, **and**
- target claim’s speaker is the **opponent**, **and**
- target is “weak”: `unsupported === true` **or** `type === needs_evidence`

\[
E(e) = \text{credit}(e) + \text{rebuttalBonus}(e)
\]

---

## 4. Undercut penalty

For each `contradicts` edge from opponent → your claim \(c\):

- if \(c\) has **no** inbound `supports` edge → subtract **1** from \(c\)’s speaker.

---

## 5. Normalization → UI ratios and 0–100 scores

Shift into non-negative mass so negative totals still compare fairly:

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

## Worked proof 1 — micro debate

Graph:

1. `c1` speaker **A**, `needs_evidence` — “Remote should be default”
2. `c2` speaker **A**, `supported` — study / evidence
3. `e1`: `c2 -supports-> c1`
4. `c3` speaker **B**, `counterargument` — “Office better”
5. `e2`: `c3 -contradicts-> c1`

Inbound support set includes `c1` (via `e1`).

| Claim | \(B\) | \(P\) | \(S\) |
|---|---|---|---|
| c1 | −1 | 0 (has inbound support) | **−1** → A |
| c2 | +3 | 0 | **+3** → A |
| c3 | +2 | 0 | **+2** → B |

| Edge | Credit | Rebuttal? | \(E\) |
|---|---|---|---|
| e1 supports | +2 | no | **+2** → A |
| e2 contradicts → c1 | +2.5 | yes (`needs_evidence`) | **+3.5** → B |

No undercut (c1 has support).

\[
\mathrm{Raw}_A = 4,\quad \mathrm{Raw}_B = 5.5
\]

\[
\mathrm{ratioA} = 4/9.5 \approx 0.421 \Rightarrow \mathrm{scoreA}=42,\ \mathrm{scoreB}=58,\ \mathrm{leader}=B
\]

Verified by unit test `micro debate: B slightly ahead`.

---

## Worked proof 2 — unsupported + fallacy + undercut

1. `cA` speaker A, `needs_evidence`, `unsupported: true`, fallacy `strawman`, no inbound support
2. `cB` speaker B, `counterargument`
3. `e`: `cB -contradicts-> cA`

| Claim | \(S\) |
|---|---|
| cA | −1 −1.5 −1 −1 = **−4.5** |
| cB | **+2** |

| Edge | \(E\) |
|---|---|
| contradicts weak | 2.5 + 1 = **3.5** → B |

Undercut on cA → A **−1**.

\[
\mathrm{Raw}_A = -5.5,\quad \mathrm{Raw}_B = 5.5 \Rightarrow \mathrm{leader}=B,\ \mathrm{ratioB}=1\ (\mathrm{decisive})
\]

Verified by unit test `unsupported fallacy undercut: B decisive`.

---

## Worked proof 3 — empty / UNKNOWN

No A/B mass → **50–50 tie**. UNKNOWN-labeled claims/edges never enter raw totals.

---

## API

### `POST /api/score`

```json
{ "claims": [...], "edges": [...] }
```

Returns raw/ratio/score fields plus `undercutA` / `undercutB`. No API key required.

### `POST /api/summary`

Additive field `debateScore` with the same snapshot shape (FE may ignore until wired).

---

## Invariants (enforced by tests)

1. `scoreA + scoreB === 100` always.
2. `ratioA + ratioB === 1` (float-safe).
3. UNKNOWN speakers never change raw scores.
4. Swapping all A↔B speakers swaps rawA↔rawB and mirrors ratios.
5. Adding a `supports` edge from A never decreases `rawA`.

---

## File map

| Path | Role |
|---|---|
| `lib/score/constants.ts` | Tunable weights |
| `lib/score/debateScore.ts` | Formula implementation |
| `lib/score/index.ts` | Public exports |
| `lib/score/debateScore.test.ts` | Unit proofs |
| `app/api/score/route.ts` | HTTP surface |
| `docs/DEBATE_SCORING.md` | This document |
