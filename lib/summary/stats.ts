/**
 * Deterministic summary statistics (claim–evidence v2).
 * No Gemini — pure counts from Claims / Evidence / Relations.
 */

import { deriveSpeakerSupport } from "@/lib/debate/status";
import type {
  Claim,
  Evidence,
  Relation,
  SummaryStats,
} from "@/lib/types/debate";

/**
 * Most-contested Claim = most frequent *target* (`to`) of
 * counters / responds_to Relations. Ties break by first claim order.
 */
export function findMostContestedClaimId(
  claims: Claim[],
  relations: Relation[],
): string | null {
  if (claims.length === 0) return null;

  const claimIds = new Set(claims.map((c) => c.id));
  const contestScore = new Map<string, number>();

  for (const r of relations) {
    if (r.type !== "counters" && r.type !== "responds_to") continue;
    if (!claimIds.has(r.to)) continue;
    contestScore.set(r.to, (contestScore.get(r.to) ?? 0) + 1);
  }

  let mostContestedClaimId: string | null = null;
  let best = 0;
  // Stable walk in claim order for tie-break
  for (const c of claims) {
    const score = contestScore.get(c.id) ?? 0;
    if (score > best) {
      best = score;
      mostContestedClaimId = c.id;
    }
  }
  return best > 0 ? mostContestedClaimId : null;
}

export function computeSummaryStats(
  claims: Claim[],
  evidence: Evidence[],
  relations: Relation[],
): SummaryStats {
  const unsupportedCount = claims.filter(
    (c) => deriveSpeakerSupport(c.id, evidence) === "unsupported",
  ).length;

  let pendingEvidenceCount = 0;
  let corroboratedEvidenceCount = 0;
  let contestedEvidenceCount = 0;
  let inconclusiveEvidenceCount = 0;
  let notVerifiableEvidenceCount = 0;

  for (const item of evidence) {
    switch (item.verification.status) {
      case "pending":
      case "error":
        // error treated as still awaiting a usable outcome for summary tallies
        pendingEvidenceCount += 1;
        break;
      case "corroborated":
        corroboratedEvidenceCount += 1;
        break;
      case "contested":
        contestedEvidenceCount += 1;
        break;
      case "inconclusive":
        inconclusiveEvidenceCount += 1;
        break;
      case "not_verifiable":
        notVerifiableEvidenceCount += 1;
        break;
      default:
        break;
    }
  }

  return {
    claimCount: claims.length,
    evidenceCount: evidence.length,
    unsupportedCount,
    pendingEvidenceCount,
    corroboratedEvidenceCount,
    contestedEvidenceCount,
    inconclusiveEvidenceCount,
    notVerifiableEvidenceCount,
    mostContestedClaimId: findMostContestedClaimId(claims, relations),
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

/**
 * Deterministic narrative when Gemini is unavailable or fails.
 * Uses source-alignment language only — never claim true/false.
 */
export function buildFallbackNarrative(stats: SummaryStats): string {
  if (stats.claimCount === 0) {
    return "No claims extracted yet. Structural summary will appear after the debate graph has content.";
  }

  const parts: string[] = [
    `The graph has ${stats.claimCount} claim${stats.claimCount === 1 ? "" : "s"} and ${stats.evidenceCount} evidence item${stats.evidenceCount === 1 ? "" : "s"}.`,
  ];

  if (stats.unsupportedCount > 0) {
    parts.push(
      `${stats.unsupportedCount} claim${stats.unsupportedCount === 1 ? "" : "s"} currently have no attached evidence.`,
    );
  }

  const verifyBits: string[] = [];
  if (stats.corroboratedEvidenceCount > 0) {
    verifyBits.push(
      `${stats.corroboratedEvidenceCount} with sources that corroborate`,
    );
  }
  if (stats.contestedEvidenceCount > 0) {
    verifyBits.push(
      `${stats.contestedEvidenceCount} with sources that contest`,
    );
  }
  if (stats.pendingEvidenceCount > 0) {
    verifyBits.push(
      `${stats.pendingEvidenceCount} pending confirmation`,
    );
  }
  if (stats.notVerifiableEvidenceCount > 0) {
    verifyBits.push(
      `${stats.notVerifiableEvidenceCount} not externally verifiable`,
    );
  }
  if (stats.inconclusiveEvidenceCount > 0) {
    verifyBits.push(
      `${stats.inconclusiveEvidenceCount} inconclusive after search`,
    );
  }
  if (verifyBits.length > 0) {
    parts.push(`Evidence status: ${verifyBits.join("; ")}.`);
  }

  if (stats.mostContestedClaimId) {
    parts.push(
      `The most contested claim in the relation graph is ${stats.mostContestedClaimId}.`,
    );
  }

  return parts.join(" ");
}
