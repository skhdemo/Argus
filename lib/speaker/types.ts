/**
 * Speaker inference types (BE2).
 * Includes UNKNOWN for extract-time diarization / soft attribution.
 * Aligns with claim–evidence v2 SpeakerId (parent contract may lag briefly).
 */

export type SpeakerId = "A" | "B" | "UNKNOWN";

export type SpeakerInference = {
  speaker: SpeakerId;
  confidence: number;
};

export type SpeakerInferInput = {
  /** Newest transcript chunk */
  text: string;
  /** Optional wider context window */
  transcriptWindow?: string;
  /** Last known speaker (client hint / previous extract) */
  lastSpeaker?: SpeakerId | null;
  /** Gap before this chunk in ms, if FE can supply it */
  pauseMs?: number;
  /** Speaker fields from the extract model JSON (one-call path) */
  modelSpeaker?: SpeakerId;
  modelConfidence?: number;
};
