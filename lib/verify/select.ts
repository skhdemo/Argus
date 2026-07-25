/**
 * Evidence verification eligibility (no Gemini).
 *
 * anecdote / reasoning → not_verifiable without Search.
 * statistic | citation | factual_claim | example | authority → searchable.
 * Recently completed Evidence is skipped unless force=true.
 */

import type {
  Evidence,
  EvidenceKind,
  EvidenceVerification,
  EvidenceVerificationStatus,
} from "@/lib/types/debate";

/** Kinds that can be checked via Google Search grounding */
export const SEARCHABLE_KINDS: readonly EvidenceKind[] = [
  "statistic",
  "citation",
  "factual_claim",
  "example",
  "authority",
] as const;

/** Kinds that short-circuit to not_verifiable (no Search) */
export const NON_SEARCHABLE_KINDS: readonly EvidenceKind[] = [
  "anecdote",
  "reasoning",
] as const;

/** Do not re-verify within this window unless force=true */
export const RECENTLY_COMPLETED_MS = 10 * 60 * 1000;

const COMPLETED_STATUSES: readonly EvidenceVerificationStatus[] = [
  "corroborated",
  "contested",
  "inconclusive",
  "not_verifiable",
] as const;

export function isSearchableKind(kind: EvidenceKind): boolean {
  return (SEARCHABLE_KINDS as readonly string[]).includes(kind);
}

export function isCompletedVerification(
  status: EvidenceVerificationStatus,
): boolean {
  return (COMPLETED_STATUSES as readonly string[]).includes(status);
}

export function isRecentlyCompleted(
  verification: EvidenceVerification,
  now = Date.now(),
  windowMs = RECENTLY_COMPLETED_MS,
): boolean {
  if (!isCompletedVerification(verification.status)) return false;
  if (typeof verification.checkedAt !== "number") return false;
  return now - verification.checkedAt < windowMs;
}

export type SelectAction =
  | {
      action: "short_circuit";
      verification: EvidenceVerification;
    }
  | {
      action: "skip";
      reason: "recently_completed";
      verification: EvidenceVerification;
    }
  | {
      action: "search";
    };

export function buildNotVerifiableVerification(
  summary: string,
  now = Date.now(),
): EvidenceVerification {
  return {
    status: "not_verifiable",
    relevance: "weak",
    confidence: 0.4,
    summary,
    sources: [],
    checkedAt: now,
  };
}

/**
 * Decide whether to Search, short-circuit, or return the existing verification.
 */
export function selectEvidenceForVerify(
  evidence: Evidence,
  opts?: { force?: boolean; now?: number },
): SelectAction {
  const now = opts?.now ?? Date.now();
  const force = opts?.force === true;

  if (!isSearchableKind(evidence.kind)) {
    return {
      action: "short_circuit",
      verification: buildNotVerifiableVerification(
        evidence.kind === "anecdote"
          ? "Personal anecdote is not suitable for external web corroboration."
          : "Abstract reasoning is not suitable for external web corroboration.",
        now,
      ),
    };
  }

  if (!force && isRecentlyCompleted(evidence.verification, now)) {
    return {
      action: "skip",
      reason: "recently_completed",
      verification: evidence.verification,
    };
  }

  return { action: "search" };
}
