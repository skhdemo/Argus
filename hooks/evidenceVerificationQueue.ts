import type {
  Claim,
  Evidence,
  EvidenceVerificationStatus,
} from "@/lib/types/debate";

const COMPLETED_STATUSES: ReadonlySet<EvidenceVerificationStatus> = new Set([
  "corroborated",
  "contested",
  "inconclusive",
  "not_verifiable",
]);

export function isCompletedVerificationStatus(
  status: EvidenceVerificationStatus,
): boolean {
  return COMPLETED_STATUSES.has(status);
}

export function findPrimaryClaim(
  evidence: Evidence,
  claims: readonly Claim[],
): Claim | null {
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  for (const claimId of evidence.supportsClaimIds) {
    const claim = claimById.get(claimId);
    if (claim) return claim;
  }
  return null;
}

export function parseRetryAfterMs(
  retryAfter: string | null,
  now = Date.now(),
  fallbackMs = 1500,
): number {
  if (!retryAfter) return fallbackMs;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? fallbackMs : Math.max(0, date - now);
}
