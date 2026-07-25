import type {
  ClaimDisplayStatus,
  ClaimNature,
  EvidenceRelevance,
  EvidenceVerificationStatus,
  RelationType,
} from "@/lib/types/debate";

export const CLAIM_STATUS_LABEL: Record<ClaimDisplayStatus, string> = {
  unsupported: "No evidence attached",
  pending_confirmation: "Checking sources",
  supported: "Sources aligned",
  weak_support: "Weak support",
  contested_evidence: "Evidence contested",
  not_externally_verifiable: "Not externally verifiable",
};

export const CLAIM_STATUS_COLOR: Record<ClaimDisplayStatus, string> = {
  unsupported: "var(--claim-unsupported)",
  pending_confirmation: "var(--claim-pending-confirmation)",
  supported: "var(--claim-supported)",
  weak_support: "var(--claim-weak-support)",
  contested_evidence: "var(--claim-contested-evidence)",
  not_externally_verifiable: "var(--claim-not-externally-verifiable)",
};

export const CLAIM_NATURE_LABEL: Record<ClaimNature, string> = {
  argument: "Argument",
  counterargument: "Counterargument",
};

export const RELATION_LABEL: Record<RelationType, string> = {
  counters: "Counters",
  responds_to: "Responds to",
};

export const VERIFICATION_STATUS_LABEL: Record<
  EvidenceVerificationStatus,
  string
> = {
  pending: "Awaiting source check",
  corroborated: "Sources aligned",
  contested: "Sources conflict",
  inconclusive: "Source check inconclusive",
  not_verifiable: "Not externally verifiable",
  error: "Source check error",
};

export const RELEVANCE_LABEL: Record<EvidenceRelevance, string> = {
  pending: "Relevance pending",
  strong: "Strong relevance",
  moderate: "Moderate relevance",
  weak: "Weak relevance",
  irrelevant: "Low relevance",
};
