import type { Claim, Edge, SummaryResponse } from "@/lib/types/debate";

/**
 * Deterministic structural counts (not model-dependent).
 * evidenceCount = number of `supports` edges (not a separate "evidence claim" type).
 * unsupportedCount = soft flags + needs_evidence without inbound support.
 */
export function computeSummaryStats(
  claims: Claim[],
  edges: Edge[],
): Pick<
  SummaryResponse,
  "claimCount" | "evidenceCount" | "unsupportedCount" | "mostContestedClaimId"
> {
  const supportedTargets = new Set(
    edges.filter((e) => e.type === "supports").map((e) => e.to),
  );

  const contestScore = new Map<string, number>();
  for (const e of edges) {
    if (e.type !== "contradicts" && e.type !== "responds_to") continue;
    contestScore.set(e.from, (contestScore.get(e.from) ?? 0) + 1);
    contestScore.set(e.to, (contestScore.get(e.to) ?? 0) + 1);
  }

  let mostContestedClaimId: string | null = null;
  let best = 0;
  for (const [id, score] of contestScore) {
    if (score > best) {
      best = score;
      mostContestedClaimId = id;
    }
  }

  const unsupportedCount = claims.filter((c) => {
    if (c.unsupported) return true;
    if (c.type === "needs_evidence" && !supportedTargets.has(c.id)) return true;
    return false;
  }).length;

  return {
    claimCount: claims.length,
    evidenceCount: edges.filter((e) => e.type === "supports").length,
    unsupportedCount,
    mostContestedClaimId,
  };
}

export function resolveMostContestedClaimId(
  candidate: string | null | undefined,
  claims: Claim[],
  fallback: string | null,
): string | null {
  if (!candidate) return fallback;
  return claims.some((c) => c.id === candidate) ? candidate : fallback;
}
