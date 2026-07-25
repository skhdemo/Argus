/**
 * Derived claim support / display status (claim–evidence v2).
 * Pure functions — no Gemini, no mutation of Claim/Evidence.
 *
 * Display precedence when multiple Evidence items attach to one Claim
 * (first matching rule wins):
 * 1. no Evidence → unsupported
 * 2. any corroborated with relevance strong|moderate → supported
 * 3. any contested (and no relevant corroboration) → contested_evidence
 * 4. any corroborated with relevance weak|irrelevant → weak_support
 * 5. any pending | inconclusive | error → pending_confirmation
 * 6. only not_verifiable → not_externally_verifiable
 */

import type {
  ClaimDisplayStatus,
  ClaimSupportStatus,
  Evidence,
  EvidenceRelevance,
  EvidenceVerificationStatus,
} from "@/lib/types/debate";

function attachedEvidence(
  claimId: string,
  evidence: Evidence[],
): Evidence[] {
  return evidence.filter((e) => e.supportsClaimIds.includes(claimId));
}

/** Did the speaker offer any Evidence for this Claim? */
export function deriveSpeakerSupport(
  claimId: string,
  evidence: Evidence[],
): ClaimSupportStatus {
  return attachedEvidence(claimId, evidence).length > 0
    ? "evidence_provided"
    : "unsupported";
}

function isRelevantCorroborated(
  status: EvidenceVerificationStatus,
  relevance: EvidenceRelevance,
): boolean {
  return (
    status === "corroborated" &&
    (relevance === "strong" || relevance === "moderate")
  );
}

function isWeakOrIrrelevantCorroborated(
  status: EvidenceVerificationStatus,
  relevance: EvidenceRelevance,
): boolean {
  return (
    status === "corroborated" &&
    (relevance === "weak" || relevance === "irrelevant")
  );
}

/**
 * UI / inspector status from attached Evidence verification + relevance.
 * See file header for mixed-evidence precedence.
 */
export function deriveClaimDisplayStatus(
  claimId: string,
  evidence: Evidence[],
): ClaimDisplayStatus {
  const attached = attachedEvidence(claimId, evidence);
  if (attached.length === 0) return "unsupported";

  let hasRelevantCorroborated = false;
  let hasWeakCorroborated = false;
  let hasContested = false;
  let hasProvisional = false;
  let hasNotVerifiable = false;

  for (const item of attached) {
    const { status, relevance } = item.verification;
    if (isRelevantCorroborated(status, relevance)) {
      hasRelevantCorroborated = true;
    } else if (isWeakOrIrrelevantCorroborated(status, relevance)) {
      hasWeakCorroborated = true;
    } else if (status === "contested") {
      hasContested = true;
    } else if (
      status === "pending" ||
      status === "inconclusive" ||
      status === "error"
    ) {
      hasProvisional = true;
    } else if (status === "not_verifiable") {
      hasNotVerifiable = true;
    }
  }

  if (hasRelevantCorroborated) return "supported";
  if (hasContested) return "contested_evidence";
  if (hasWeakCorroborated) return "weak_support";
  if (hasProvisional) return "pending_confirmation";
  if (hasNotVerifiable) return "not_externally_verifiable";

  // Defensive fallback (e.g. only corroborated+pending relevance edge cases)
  return "pending_confirmation";
}
