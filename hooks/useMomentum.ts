import { useMemo } from "react";

import type { Claim } from "@/lib/types/debate";

/**
 * Threshold at which momentum reads as decisive enough to show an explicit
 * "Speaker X is winning" callout, rather than just a background lean.
 */
export const MOMENTUM_DECISIVE_THRESHOLD = 0.7;

export type MomentumState = {
  /** Share of "momentum mass" held by speaker A, 0..1. */
  ratioA: number;
  /** = 1 - ratioA. */
  ratioB: number;
  leader: "A" | "B" | "tied";
  /** max(ratioA, ratioB) — how lopsided the current lead is. */
  leaderShare: number;
  isDecisive: boolean;
};

const TIED: MomentumState = {
  ratioA: 0.5,
  ratioB: 0.5,
  leader: "tied",
  leaderShare: 0.5,
  isDecisive: false,
};

/**
 * Placeholder scoring, computed purely client-side from data already in the
 * contract: supported claims count for a speaker, needs_evidence claims
 * count against them. This is a deliberate stopgap — see
 * docs/backend-argument-strength-proposal.md for the real, Gemini-scored
 * replacement. Swapping that in only requires changing the body of this
 * function; MomentumState and every consumer of it stay the same.
 */
export function computeMomentum(claims: Claim[]): MomentumState {
  let scoreA = 0;
  let scoreB = 0;

  for (const claim of claims) {
    const delta =
      claim.type === "supported" ? 1 : claim.type === "needs_evidence" ? -1 : 0;
    if (claim.speaker === "A") scoreA += delta;
    else if (claim.speaker === "B") scoreB += delta;
  }

  // Shift into non-negative space before normalizing so a negative-vs-less-
  // negative matchup still yields a sensible ratio instead of going negative.
  const floor = Math.min(scoreA, scoreB, 0);
  const a = scoreA - floor;
  const b = scoreB - floor;
  const total = a + b;

  if (total === 0) return TIED;

  const ratioA = a / total;
  const ratioB = 1 - ratioA;
  const leaderShare = Math.max(ratioA, ratioB);
  const leader = ratioA === ratioB ? "tied" : ratioA > ratioB ? "A" : "B";

  return {
    ratioA,
    ratioB,
    leader,
    leaderShare,
    isDecisive: leaderShare > MOMENTUM_DECISIVE_THRESHOLD,
  };
}

export function useMomentum(claims: Claim[]): MomentumState {
  return useMemo(() => computeMomentum(claims), [claims]);
}
