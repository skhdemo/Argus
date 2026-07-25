/**
 * Argus shared debate contract — claim–evidence v2.
 *
 * Ontology:
 * - Claim = graph node (nature: argument | counterargument)
 * - Evidence = first-class non-node justification (ev_ ids), never a graph node
 * - Relation = claim↔claim only (counters | responds_to)
 *
 * Structural support (speaker offered Evidence) is derived — never a Claim field.
 * External corroboration lives on Evidence.verification — never a claim true/false label.
 *
 * Transcription contracts are unchanged from v1.
 */

export type SpeakerId = "A" | "B" | "UNKNOWN";

/** Rhetorical role of a Claim. Support status is derived separately. */
export type ClaimNature = "argument" | "counterargument";

/**
 * Did the speaker offer Evidence for this Claim?
 * Derived via deriveSpeakerSupport(claimId, evidence) — never persisted on Claim.
 */
export type ClaimSupportStatus = "unsupported" | "evidence_provided";

/**
 * UI / inspector display status derived from attached Evidence verification + relevance.
 * Never a Gemini extract field.
 */
export type ClaimDisplayStatus =
  | "unsupported"
  | "pending_confirmation"
  | "supported"
  | "weak_support"
  | "contested_evidence"
  | "not_externally_verifiable";

/** Claim↔claim relation kinds. Evidence support uses Evidence.supportsClaimIds. */
export type RelationType = "counters" | "responds_to";

export type EvidenceKind =
  | "statistic"
  | "citation"
  | "factual_claim"
  | "example"
  | "anecdote"
  | "reasoning"
  | "authority";

export type EvidenceVerificationStatus =
  | "pending"
  | "corroborated"
  | "contested"
  | "inconclusive"
  | "not_verifiable"
  | "error";

export type EvidenceRelevance =
  | "pending"
  | "strong"
  | "moderate"
  | "weak"
  | "irrelevant";

export type FallacyTag =
  | "ad_hominem"
  | "strawman"
  | "circular_reasoning"
  | "false_dilemma";

export type VerifyErrorCode =
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "BLOCKED"
  | "PARSE"
  | "UPSTREAM"
  | "VERIFY_DISABLED"
  | "MISSING_KEY";

export type SourceLink = {
  uri: string;
  title?: string;
  domain?: string;
};

/**
 * External source corroboration for speaker-provided Evidence.
 * Empty grounding sources can never yield status "corroborated".
 */
export type EvidenceVerification = {
  status: EvidenceVerificationStatus;
  relevance: EvidenceRelevance;
  /** Soft 0–1 confidence from the verifier */
  confidence?: number;
  /** Source-alignment summary — never claim true/false language */
  summary?: string;
  sources: SourceLink[];
  webSearchQueries?: string[];
  checkedAt?: number;
  errorCode?: VerifyErrorCode;
};

export type Claim = {
  /** Stable id with `c_` prefix */
  id: string;
  text: string;
  speaker: SpeakerId;
  speakerConfidence?: number;
  nature: ClaimNature;
  /** Soft tags only — never auto-collapse or hard-block the node */
  fallacies?: FallacyTag[];
  sourceExcerpt?: string;
  createdAt: number;
  updatedAt?: number;
};

export type Evidence = {
  /** Stable id with `ev_` prefix */
  id: string;
  /** Justification actually provided by the speaker */
  text: string;
  speaker: SpeakerId;
  /** One or more Claim IDs — never Evidence IDs */
  supportsClaimIds: string[];
  kind: EvidenceKind;
  sourceExcerpt?: string;
  verification: EvidenceVerification;
  createdAt: number;
  updatedAt?: number;
};

export type Relation = {
  /** Stable id with `r_` prefix */
  id: string;
  /** Claim ID */
  from: string;
  /** Claim ID */
  to: string;
  type: RelationType;
};

export type ExtractRequest = {
  text: string;
  transcriptWindow?: string;
  inferredSpeaker?: SpeakerId | null;
  pauseMs?: number;
  existingClaims: Claim[];
  existingEvidence: Evidence[];
  existingRelations: Relation[];
};

/**
 * Server returns deltas only. Client merges by id.
 * Updates to an existing claim/evidence reuse the same id.
 */
export type ExtractResponse = {
  claims: Claim[];
  evidence: Evidence[];
  relations: Relation[];
  inferredSpeaker: SpeakerId;
  speakerConfidence: number;
  /** Debug only — hide in prod UI */
  notes?: string;
};

export type VerifyEvidenceRequest = {
  evidence: Evidence;
  /** Primary Claim used for relevance evaluation */
  claim: Claim;
  /** Force re-verify even if recently completed */
  force?: boolean;
};

export type VerifyEvidenceResponse = {
  evidenceId: string;
  verification: EvidenceVerification;
  /** Hint for FE inspector; FE may also re-derive locally */
  displayStatusHint?: ClaimDisplayStatus;
};

export type SummaryRequest = {
  claims: Claim[];
  evidence: Evidence[];
  relations: Relation[];
};

export type SummaryStats = {
  claimCount: number;
  evidenceCount: number;
  unsupportedCount: number;
  pendingEvidenceCount: number;
  corroboratedEvidenceCount: number;
  contestedEvidenceCount: number;
  inconclusiveEvidenceCount: number;
  notVerifiableEvidenceCount: number;
  mostContestedClaimId: string | null;
};

export type SummaryResponse = SummaryStats & {
  narrative: string;
  /** Required deterministic score snapshot */
  debateScore: DebateScoreSnapshot;
};

/** Compact speaker score snapshot — see docs/DEBATE_SCORING.md */
export type DebateScoreSnapshot = {
  rawA: number;
  rawB: number;
  ratioA: number;
  ratioB: number;
  scoreA: number;
  scoreB: number;
  leader: "A" | "B" | "tied";
  leaderShare: number;
  isDecisive: boolean;
};

export type ScoreRequest = {
  claims: Claim[];
  evidence: Evidence[];
  relations: Relation[];
};

export type ScoreResponse = DebateScoreSnapshot & {
  undercutA?: number;
  undercutB?: number;
};

export type ApiErrorBody = {
  error: string;
  code:
    | "BAD_REQUEST"
    | "UPSTREAM"
    | "PARSE"
    | "MISSING_KEY"
    | "RATE_LIMIT"
    | "TIMEOUT"
    | "BLOCKED"
    | "VERIFY_DISABLED";
};

/** One diarized utterance from Gemini audio transcription */
export type TranscriptSegment = {
  speaker: SpeakerId;
  text: string;
  /** Optional MM:SS-style offset within the audio chunk */
  timestamp?: string;
};

export type TranscribeResponse = {
  text: string;
  segments: TranscriptSegment[];
  inferredSpeaker: SpeakerId;
  speakerConfidence: number;
  notes?: string;
};
