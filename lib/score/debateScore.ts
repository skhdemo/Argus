/**
 * Deterministic debate scoring from the claim/edge graph.
 *
 * Speaker labels come from Gemini STT/diarization → extract.
 * This module does NOT call Gemini — pure graph math.
 *
 * Spec + worked proofs: docs/DEBATE_SCORING.md
 */

import {
  CLAIM_BASE,
  DECISIVE_LEADER_SHARE,
  EDGE_CREDIT,
  EDGE_REBUTTAL_BONUS,
  PENALTY_FALLACY_CAP,
  PENALTY_NEEDS_EVIDENCE_NO_SUPPORT,
  PENALTY_PER_FALLACY,
  PENALTY_UNSUPPORTED,
  UNDERCUT_PENALTY,
} from "@/lib/score/constants";
import type { Claim, Edge, SpeakerId } from "@/lib/types/debate";

export type ScoreLeader = "A" | "B" | "tied";

export type DebateScoreResult = {
  rawA: number;
  rawB: number;
  /** Non-negative masses used for ratio (after floor shift). */
  massA: number;
  massB: number;
  ratioA: number;
  ratioB: number;
  /** Display scores 0–100 that sum to 100 (50–50 if tied empty). */
  scoreA: number;
  scoreB: number;
  leader: ScoreLeader;
  leaderShare: number;
  isDecisive: boolean;
};

export type ClaimScoreBreakdown = {
  claimId: string;
  speaker: SpeakerId;
  base: number;
  penalties: number;
  total: number;
};

export type EdgeScoreBreakdown = {
  edgeId: string;
  speaker: SpeakerId;
  credit: number;
  rebuttalBonus: number;
  total: number;
};

export type DebateScoreBreakdown = DebateScoreResult & {
  claimScores: ClaimScoreBreakdown[];
  edgeScores: EdgeScoreBreakdown[];
  undercutA: number;
  undercutB: number;
};

function isScoredSpeaker(s: SpeakerId): s is "A" | "B" {
  return s === "A" || s === "B";
}

function inboundSupportIds(edges: Edge[]): Set<string> {
  return new Set(edges.filter((e) => e.type === "supports").map((e) => e.to));
}

/**
 * Soft penalties for one claim (non-positive number).
 */
export function claimPenalties(
  claim: Claim,
  hasInboundSupport: boolean,
): number {
  let p = 0;
  if (claim.unsupported) p -= PENALTY_UNSUPPORTED;
  if (claim.type === "needs_evidence" && !hasInboundSupport) {
    p -= PENALTY_NEEDS_EVIDENCE_NO_SUPPORT;
  }
  const fallacyCount = claim.fallacies?.length ?? 0;
  if (fallacyCount > 0) {
    p -= Math.min(PENALTY_FALLACY_CAP, fallacyCount * PENALTY_PER_FALLACY);
  }
  return p;
}

/** S_claim(c) = B(c) + P(c) */
export function scoreClaim(
  claim: Claim,
  hasInboundSupport: boolean,
): ClaimScoreBreakdown {
  const base = CLAIM_BASE[claim.type];
  const penalties = claimPenalties(claim, hasInboundSupport);
  return {
    claimId: claim.id,
    speaker: claim.speaker,
    base,
    penalties,
    total: base + penalties,
  };
}

function isWeakClaim(claim: Claim): boolean {
  return (
    claim.unsupported === true ||
    claim.type === "needs_evidence"
  );
}

/**
 * Full structural score for speakers A and B.
 * Claims/edges with speaker UNKNOWN contribute nothing.
 */
export function computeDebateScore(
  claims: Claim[],
  edges: Edge[],
): DebateScoreBreakdown {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const supported = inboundSupportIds(edges);

  let rawA = 0;
  let rawB = 0;
  const claimScores: ClaimScoreBreakdown[] = [];
  const edgeScores: EdgeScoreBreakdown[] = [];

  for (const claim of claims) {
    const breakdown = scoreClaim(claim, supported.has(claim.id));
    claimScores.push(breakdown);
    if (claim.speaker === "A") rawA += breakdown.total;
    else if (claim.speaker === "B") rawB += breakdown.total;
  }

  for (const edge of edges) {
    const fromClaim = byId.get(edge.from);
    const toClaim = byId.get(edge.to);
    if (!fromClaim || !isScoredSpeaker(fromClaim.speaker)) continue;

    let credit = EDGE_CREDIT[edge.type];
    let rebuttalBonus = 0;

    if (
      (edge.type === "contradicts" || edge.type === "responds_to") &&
      toClaim &&
      isScoredSpeaker(toClaim.speaker) &&
      toClaim.speaker !== fromClaim.speaker &&
      isWeakClaim(toClaim)
    ) {
      rebuttalBonus = EDGE_REBUTTAL_BONUS;
    }

    const total = credit + rebuttalBonus;
    edgeScores.push({
      edgeId: edge.id,
      speaker: fromClaim.speaker,
      credit,
      rebuttalBonus,
      total,
    });

    if (fromClaim.speaker === "A") rawA += total;
    else rawB += total;
  }

  // Undercut: contradicted with no inbound support → owner loses points
  let undercutA = 0;
  let undercutB = 0;
  for (const edge of edges) {
    if (edge.type !== "contradicts") continue;
    const fromClaim = byId.get(edge.from);
    const toClaim = byId.get(edge.to);
    if (!fromClaim || !toClaim) continue;
    if (!isScoredSpeaker(fromClaim.speaker) || !isScoredSpeaker(toClaim.speaker)) {
      continue;
    }
    if (fromClaim.speaker === toClaim.speaker) continue;
    if (supported.has(toClaim.id)) continue;

    if (toClaim.speaker === "A") {
      undercutA += UNDERCUT_PENALTY;
      rawA -= UNDERCUT_PENALTY;
    } else {
      undercutB += UNDERCUT_PENALTY;
      rawB -= UNDERCUT_PENALTY;
    }
  }

  const normalized = normalizeSpeakerScores(rawA, rawB);

  return {
    ...normalized,
    claimScores,
    edgeScores,
    undercutA,
    undercutB,
  };
}

/**
 * Floor-shift into non-negative masses, then ratios and 0–100 display scores.
 */
export function normalizeSpeakerScores(
  rawA: number,
  rawB: number,
): DebateScoreResult {
  const floor = Math.min(rawA, rawB, 0);
  const massA = rawA - floor;
  const massB = rawB - floor;
  const total = massA + massB;

  if (total === 0) {
    return {
      rawA,
      rawB,
      massA: 0,
      massB: 0,
      ratioA: 0.5,
      ratioB: 0.5,
      scoreA: 50,
      scoreB: 50,
      leader: "tied",
      leaderShare: 0.5,
      isDecisive: false,
    };
  }

  const ratioA = massA / total;
  const ratioB = 1 - ratioA;
  const leaderShare = Math.max(ratioA, ratioB);
  const leader: ScoreLeader =
    ratioA === ratioB ? "tied" : ratioA > ratioB ? "A" : "B";

  // Round scoreA; scoreB is complement so they always sum to 100.
  const scoreA = Math.round(100 * ratioA);
  const scoreB = 100 - scoreA;

  return {
    rawA,
    rawB,
    massA,
    massB,
    ratioA,
    ratioB,
    scoreA,
    scoreB,
    leader,
    leaderShare,
    isDecisive: leader !== "tied" && leaderShare >= DECISIVE_LEADER_SHARE,
  };
}

/** Compact payload for API / FE consumers */
export function toDebateScorePayload(
  result: DebateScoreBreakdown,
): DebateScoreResult {
  const {
    rawA,
    rawB,
    massA,
    massB,
    ratioA,
    ratioB,
    scoreA,
    scoreB,
    leader,
    leaderShare,
    isDecisive,
  } = result;
  return {
    rawA,
    rawB,
    massA,
    massB,
    ratioA,
    ratioB,
    scoreA,
    scoreB,
    leader,
    leaderShare,
    isDecisive,
  };
}
