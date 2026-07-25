/**
 * Argus shared debate contract (BE1 owns).
 *
 * Freeze after A0.3: additive changes only via `contract/*` PRs.
 * Discord: post freeze notice in #argus-contracts when this lands.
 */

export type SpeakerId = "A" | "B" | "UNKNOWN";

export type ClaimType =
  | "supported"
  | "assumption"
  | "needs_evidence"
  | "counterargument";

export type EdgeType = "supports" | "contradicts" | "responds_to";

/** FUTURE BE2 — ad hominem | strawman | circular | false_dilemma */
export type FallacyTag =
  | "ad_hominem"
  | "strawman"
  | "circular_reasoning"
  | "false_dilemma";

export type Claim = {
  id: string;
  text: string;
  speaker: SpeakerId;
  /** FUTURE BE2 — 0–1 confidence from auto attribution */
  speakerConfidence?: number;
  type: ClaimType;
  /** FUTURE BE2 — soft warning, not a truth verdict */
  unsupported?: boolean;
  /** FUTURE BE2 */
  fallacies?: FallacyTag[];
  /** FUTURE — transcript sync (Could Have) */
  sourceExcerpt?: string;
  createdAt: number;
};

export type Edge = {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
};

export type ExtractRequest = {
  /** New transcript chunk(s) since last call */
  text: string;
  /** Optional recent context window */
  transcriptWindow?: string;
  /** Client hint; server may override (BE2 speaker inference) */
  inferredSpeaker?: SpeakerId | null;
  existingClaims: Claim[];
  existingEdges: Edge[];
};

/**
 * Server returns deltas only. Client merges by id.
 * Updates to an existing claim reuse the same id.
 */
export type ExtractResponse = {
  claims: Claim[];
  edges: Edge[];
  inferredSpeaker: SpeakerId;
  speakerConfidence: number;
  /** Debug only — hide in prod UI */
  notes?: string;
};

export type SummaryRequest = {
  claims: Claim[];
  edges: Edge[];
};

export type SummaryResponse = {
  claimCount: number;
  evidenceCount: number;
  unsupportedCount: number;
  mostContestedClaimId: string | null;
  narrative: string;
  /** Deterministic structural debate score (additive; FE may ignore). */
  debateScore?: DebateScoreSnapshot;
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
  edges: Edge[];
};

export type ScoreResponse = DebateScoreSnapshot & {
  /** Optional debug breakdown for tooling / demos */
  undercutA?: number;
  undercutB?: number;
};

export type ApiErrorBody = {
  error: string;
  code: "BAD_REQUEST" | "UPSTREAM" | "PARSE" | "MISSING_KEY";
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
