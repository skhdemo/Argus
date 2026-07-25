/**
 * Deterministic debate scoring from Claims + Evidence + Relations (v2).
 *
 * Speaker labels come from Gemini STT/diarization → extract.
 * This module does NOT call Gemini — pure graph math.
 *
 * Spec + Messi worked proof: docs/DEBATE_SCORING.md
 */

import { deriveSpeakerSupport } from "@/lib/debate/status";
import {
  CLAIM_NATURE_BASE,
  DECISIVE_LEADER_SHARE,
  EVIDENCE_NEGATIVE_FLOOR,
  EVIDENCE_POSITIVE_CAP,
  EVIDENCE_UNIT_MULTIPLIER,
  PENALTY_FALLACY_CAP,
  PENALTY_PER_FALLACY,
  PENALTY_UNSUPPORTED,
  RELATION_CREDIT,
  RELATION_REBUTTAL_BONUS,
  RELEVANCE_WEIGHT,
  UNDERCUT_PENALTY,
  VERIFICATION_WEIGHT,
} from "@/lib/score/constants";
import type {
  Claim,
  DebateScoreSnapshot,
  Evidence,
  Relation,
  SpeakerId,
} from "@/lib/types/debate";

export type ScoreLeader = DebateScoreSnapshot["leader"];

export type DebateScoreResult = DebateScoreSnapshot & {
  /** Non-negative masses used for ratio (after floor shift). */
  massA: number;
  massB: number;
};

export type ClaimScoreBreakdown = {
  claimId: string;
  speaker: SpeakerId;
  base: number;
  evidenceContribution: number;
  unsupportedPenalty: number;
  fallacyPenalty: number;
  total: number;
};

export type EvidenceScoreBreakdown = {
  evidenceId: string;
  /** Per-target share before claim-level clamp */
  unitTotal: number;
  targetCount: number;
  perTargetShare: number;
  supportsClaimIds: string[];
};

export type RelationScoreBreakdown = {
  relationId: string;
  speaker: SpeakerId;
  credit: number;
  rebuttalBonus: number;
  total: number;
};

export type DebateScoreBreakdown = DebateScoreResult & {
  claimScores: ClaimScoreBreakdown[];
  evidenceScores: EvidenceScoreBreakdown[];
  relationScores: RelationScoreBreakdown[];
  undercutA: number;
  undercutB: number;
};

function isScoredSpeaker(s: SpeakerId): s is "A" | "B" {
  return s === "A" || s === "B";
}

/** Raw unit for one Evidence item before splitting across targets. */
export function evidenceUnit(evidence: Evidence): number {
  const { status, relevance } = evidence.verification;
  return (
    VERIFICATION_WEIGHT[status] *
    RELEVANCE_WEIGHT[relevance] *
    EVIDENCE_UNIT_MULTIPLIER
  );
}

/**
 * Soft penalties for one claim (unsupported + fallacies).
 * Unsupported is applied only when no Evidence references the claim.
 */
export function claimPenalties(
  claim: Claim,
  evidence: Evidence[],
): { unsupportedPenalty: number; fallacyPenalty: number } {
  const support = deriveSpeakerSupport(claim.id, evidence);
  const unsupportedPenalty =
    support === "unsupported" ? -PENALTY_UNSUPPORTED : 0;

  const fallacyCount = claim.fallacies?.length ?? 0;
  const fallacyPenalty =
    fallacyCount > 0
      ? -Math.min(PENALTY_FALLACY_CAP, fallacyCount * PENALTY_PER_FALLACY)
      : 0;

  return { unsupportedPenalty, fallacyPenalty };
}

function clampEvidenceContribution(sum: number): number {
  return Math.min(
    EVIDENCE_POSITIVE_CAP,
    Math.max(EVIDENCE_NEGATIVE_FLOOR, sum),
  );
}

/**
 * Score one Claim: nature base + clamped evidence share + penalties.
 * Evidence is never scored as a Claim.
 */
export function scoreClaim(
  claim: Claim,
  evidence: Evidence[],
  evidenceShareByClaim: Map<string, number>,
): ClaimScoreBreakdown {
  const base = CLAIM_NATURE_BASE[claim.nature];
  const evidenceContribution = clampEvidenceContribution(
    evidenceShareByClaim.get(claim.id) ?? 0,
  );
  const { unsupportedPenalty, fallacyPenalty } = claimPenalties(
    claim,
    evidence,
  );
  return {
    claimId: claim.id,
    speaker: claim.speaker,
    base,
    evidenceContribution,
    unsupportedPenalty,
    fallacyPenalty,
    total: base + evidenceContribution + unsupportedPenalty + fallacyPenalty,
  };
}

/**
 * Split each Evidence item's unit evenly across supportsClaimIds,
 * then accumulate per Claim (clamp applied later in scoreClaim).
 */
export function accumulateEvidenceShares(evidence: Evidence[]): {
  shareByClaim: Map<string, number>;
  evidenceScores: EvidenceScoreBreakdown[];
} {
  const shareByClaim = new Map<string, number>();
  const evidenceScores: EvidenceScoreBreakdown[] = [];

  for (const item of evidence) {
    const targets = [...new Set(item.supportsClaimIds)];
    if (targets.length === 0) continue;

    const unitTotal = evidenceUnit(item);
    const perTargetShare = unitTotal / targets.length;

    evidenceScores.push({
      evidenceId: item.id,
      unitTotal,
      targetCount: targets.length,
      perTargetShare,
      supportsClaimIds: targets,
    });

    for (const claimId of targets) {
      shareByClaim.set(
        claimId,
        (shareByClaim.get(claimId) ?? 0) + perTargetShare,
      );
    }
  }

  return { shareByClaim, evidenceScores };
}

/**
 * Full structural score for speakers A and B.
 * Claims / Evidence / Relations with speaker UNKNOWN contribute nothing
 * (Evidence credit rides on the Claim speaker after split).
 */
export function computeDebateScore(
  claims: Claim[],
  evidence: Evidence[],
  relations: Relation[],
): DebateScoreBreakdown {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const { shareByClaim, evidenceScores } = accumulateEvidenceShares(evidence);

  let rawA = 0;
  let rawB = 0;
  const claimScores: ClaimScoreBreakdown[] = [];
  const relationScores: RelationScoreBreakdown[] = [];

  for (const claim of claims) {
    const breakdown = scoreClaim(claim, evidence, shareByClaim);
    claimScores.push(breakdown);
    if (claim.speaker === "A") rawA += breakdown.total;
    else if (claim.speaker === "B") rawB += breakdown.total;
  }

  for (const relation of relations) {
    const fromClaim = byId.get(relation.from);
    const toClaim = byId.get(relation.to);
    if (!fromClaim || !isScoredSpeaker(fromClaim.speaker)) continue;

    let credit = RELATION_CREDIT[relation.type];
    let rebuttalBonus = 0;

    const targetUnsupported =
      toClaim != null &&
      deriveSpeakerSupport(toClaim.id, evidence) === "unsupported";

    if (
      toClaim &&
      isScoredSpeaker(toClaim.speaker) &&
      toClaim.speaker !== fromClaim.speaker &&
      targetUnsupported
    ) {
      rebuttalBonus = RELATION_REBUTTAL_BONUS;
    }

    const total = credit + rebuttalBonus;
    relationScores.push({
      relationId: relation.id,
      speaker: fromClaim.speaker,
      credit,
      rebuttalBonus,
      total,
    });

    if (fromClaim.speaker === "A") rawA += total;
    else rawB += total;
  }

  // Undercut: counters against unsupported opponent claim → owner loses points
  let undercutA = 0;
  let undercutB = 0;
  for (const relation of relations) {
    if (relation.type !== "counters") continue;
    const fromClaim = byId.get(relation.from);
    const toClaim = byId.get(relation.to);
    if (!fromClaim || !toClaim) continue;
    if (!isScoredSpeaker(fromClaim.speaker) || !isScoredSpeaker(toClaim.speaker)) {
      continue;
    }
    if (fromClaim.speaker === toClaim.speaker) continue;
    if (deriveSpeakerSupport(toClaim.id, evidence) !== "unsupported") continue;

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
    evidenceScores,
    relationScores,
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

/** Compact payload for API / FE consumers (DebateScoreSnapshot). */
export function toDebateScorePayload(
  result: DebateScoreBreakdown | DebateScoreResult,
): DebateScoreSnapshot {
  return {
    rawA: result.rawA,
    rawB: result.rawB,
    ratioA: result.ratioA,
    ratioB: result.ratioB,
    scoreA: result.scoreA,
    scoreB: result.scoreB,
    leader: result.leader,
    leaderShare: result.leaderShare,
    isDecisive: result.isDecisive,
  };
}
