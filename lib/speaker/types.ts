import type { SpeakerId } from "@/lib/types/debate";

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
