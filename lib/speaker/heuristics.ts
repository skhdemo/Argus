import type { SpeakerId } from "@/lib/types/debate";

import type { SpeakerInference } from "@/lib/speaker/types";

/** Pause gap that may indicate a turn change (plan: >1.5s). */
export const TURN_PAUSE_MS = 1500;

/** Heuristic confidence is always capped — never fake certainty. */
export const HEURISTIC_CONFIDENCE_MAX = 0.4;

const DISAGREEMENT_CUES =
  /\b(but|however|i disagree|actually|wait|no,|you're wrong|you said|on the contrary)\b/i;

export function oppositeSpeaker(speaker: SpeakerId): SpeakerId {
  if (speaker === "A") return "B";
  if (speaker === "B") return "A";
  return "UNKNOWN";
}

export function hasDisagreementCue(text: string): boolean {
  return DISAGREEMENT_CUES.test(text.trim());
}

export function isLongPause(pauseMs: number | undefined): boolean {
  return typeof pauseMs === "number" && pauseMs > TURN_PAUSE_MS;
}

/**
 * Network-free speaker guess for demo failover.
 * Confidence is always ≤ HEURISTIC_CONFIDENCE_MAX.
 */
export function heuristicInferSpeaker(input: {
  text: string;
  lastSpeaker?: SpeakerId | null;
  pauseMs?: number;
}): SpeakerInference {
  const text = input.text.trim();
  const last = input.lastSpeaker ?? null;
  const cue = text.length > 0 && hasDisagreementCue(text);
  const pause = isLongPause(input.pauseMs);

  if (cue && (pause || last === "A" || last === "B")) {
    if (last === "A" || last === "B") {
      return {
        speaker: oppositeSpeaker(last),
        confidence: pause ? 0.4 : 0.35,
      };
    }
  }

  if (last === "A" || last === "B") {
    return { speaker: last, confidence: 0.3 };
  }

  return { speaker: "UNKNOWN", confidence: 0.25 };
}

/** Clamp to [0, 1] and round lightly for stable JSON. */
export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 1000) / 1000;
}
