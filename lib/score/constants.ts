/**
 * Tunable weights for structural debate scoring (BE).
 * See docs/DEBATE_SCORING.md for the full formula and proofs.
 */

import type { ClaimType, EdgeType } from "@/lib/types/debate";

/** Base points by claim type */
export const CLAIM_BASE: Record<ClaimType, number> = {
  supported: 3,
  counterargument: 2,
  assumption: 0.5,
  needs_evidence: -1,
};

/** Soft structural penalties (subtracted) */
export const PENALTY_UNSUPPORTED = 1.5;
export const PENALTY_NEEDS_EVIDENCE_NO_SUPPORT = 1;
export const PENALTY_PER_FALLACY = 1;
export const PENALTY_FALLACY_CAP = 3;

/** Edge move credits — awarded to speaker of edge.from */
export const EDGE_CREDIT: Record<EdgeType, number> = {
  supports: 2,
  contradicts: 2.5,
  responds_to: 1,
};

/** Extra credit when attacking a weak opponent claim */
export const EDGE_REBUTTAL_BONUS = 1;

/** Penalty to claim owner when contradicted with no inbound support */
export const UNDERCUT_PENALTY = 1;

/**
 * Leader share above this → decisive lead (backend MomentumState mirror).
 * Slightly below the old 0.7 UI threshold so live demos show a callout sooner.
 */
export const DECISIVE_LEADER_SHARE = 0.62;
