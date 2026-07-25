/**
 * Tunable weights for claim–evidence v2 debate scoring.
 * See docs/DEBATE_SCORING.md for the full formula and Messi proof.
 */

import type {
  ClaimNature,
  EvidenceRelevance,
  EvidenceVerificationStatus,
  RelationType,
} from "@/lib/types/debate";

/** Base points by claim nature (role only — not support status). */
export const CLAIM_NATURE_BASE: Record<ClaimNature, number> = {
  argument: 1,
  counterargument: 1,
};

/** Verification weights for Evidence contribution */
export const VERIFICATION_WEIGHT: Record<EvidenceVerificationStatus, number> = {
  pending: 0.25,
  corroborated: 1.0,
  contested: -0.5,
  inconclusive: 0.15,
  not_verifiable: 0.2,
  error: 0.25,
};

/** Relevance weights (multiplied with verification weight) */
export const RELEVANCE_WEIGHT: Record<EvidenceRelevance, number> = {
  pending: 0.5,
  strong: 1.0,
  moderate: 0.7,
  weak: 0.3,
  irrelevant: 0,
};

/** Scales verification × relevance into claim contribution units */
export const EVIDENCE_UNIT_MULTIPLIER = 1.5;

/** Clamp summed Evidence contribution per Claim */
export const EVIDENCE_POSITIVE_CAP = 3;
export const EVIDENCE_NEGATIVE_FLOOR = -1.5;

/** Applied once when no Evidence references the Claim */
export const PENALTY_UNSUPPORTED = 1.5;

export const PENALTY_PER_FALLACY = 1;
export const PENALTY_FALLACY_CAP = 3;

/** Relation move credits — awarded to speaker of relation.from */
export const RELATION_CREDIT: Record<RelationType, number> = {
  counters: 2,
  responds_to: 1,
};

/** Extra credit when attacking an unsupported opponent Claim */
export const RELATION_REBUTTAL_BONUS = 1;

/** Penalty to target owner when countered while unsupported */
export const UNDERCUT_PENALTY = 1;

/**
 * Leader share above this → decisive lead (backend MomentumState mirror).
 */
export const DECISIVE_LEADER_SHARE = 0.62;

/** Demo payload guards for POST /api/score */
export const SCORE_MAX_CLAIMS = 200;
export const SCORE_MAX_EVIDENCE = 400;
export const SCORE_MAX_RELATIONS = 400;
