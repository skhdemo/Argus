/**
 * Speaker inference (BE2).
 *
 * Decision (B3.2.3 — proposed default): ONE Gemini call.
 * Extract already returns inferredSpeaker + speakerConfidence; this module
 * normalizes those fields and falls back to heuristics when the model is
 * weak/missing. A second generateContent path can be added later if rehearsal
 * quality requires it — do not enable by default (latency).
 */

import {
  clampConfidence,
  heuristicInferSpeaker,
  HEURISTIC_CONFIDENCE_MAX,
} from "@/lib/speaker/heuristics";
import type {
  SpeakerId,
  SpeakerInferInput,
  SpeakerInference,
} from "@/lib/speaker/types";

export type {
  SpeakerId,
  SpeakerInferInput,
  SpeakerInference,
} from "@/lib/speaker/types";
export {
  heuristicInferSpeaker,
  hasDisagreementCue,
  isLongPause,
  oppositeSpeaker,
  TURN_PAUSE_MS,
  HEURISTIC_CONFIDENCE_MAX,
} from "@/lib/speaker/heuristics";
export {
  SPEAKER_INSTRUCTIONS,
  buildSpeakerUserPromptSlice,
} from "@/lib/speaker/prompt";

function isSpeakerId(value: unknown): value is SpeakerId {
  return value === "A" || value === "B" || value === "UNKNOWN";
}

/**
 * Zod/extract defaults often yield UNKNOWN + 0.5 when the model omits fields.
 * Treat that as "no real model signal" so heuristics can run.
 */
function isWeakModelSignal(
  speaker: SpeakerId,
  confidence: number,
): boolean {
  return speaker === "UNKNOWN" && confidence <= 0.5;
}

/**
 * Resolve speaker for an extract cycle.
 * Prefers model fields when confidence is usable; otherwise heuristics (≤0.4).
 */
export function inferSpeaker(input: SpeakerInferInput): SpeakerInference {
  const cueText = [input.transcriptWindow, input.text]
    .filter((part): part is string => Boolean(part?.trim()))
    .join("\n");

  const heuristic = heuristicInferSpeaker({
    text: cueText || input.text,
    lastSpeaker: input.lastSpeaker,
    pauseMs: input.pauseMs,
  });

  const modelSpeaker = isSpeakerId(input.modelSpeaker)
    ? input.modelSpeaker
    : undefined;
  const modelConfidence =
    typeof input.modelConfidence === "number" &&
    Number.isFinite(input.modelConfidence)
      ? clampConfidence(input.modelConfidence)
      : undefined;

  // No usable model signal → heuristic only (capped).
  if (
    !modelSpeaker ||
    modelConfidence === undefined ||
    isWeakModelSignal(modelSpeaker, modelConfidence)
  ) {
    return {
      speaker: heuristic.speaker,
      confidence: Math.min(heuristic.confidence, HEURISTIC_CONFIDENCE_MAX),
    };
  }

  // Strong-enough model attribution.
  if (modelSpeaker !== "UNKNOWN" && modelConfidence >= 0.55) {
    return {
      speaker: modelSpeaker,
      confidence: modelConfidence,
    };
  }

  // Model unsure — prefer heuristic when it offers A/B (flip or continuity).
  if (
    heuristic.speaker !== "UNKNOWN" &&
    heuristic.speaker !== modelSpeaker &&
    heuristic.confidence >= 0.3
  ) {
    return {
      speaker: heuristic.speaker,
      confidence: Math.min(heuristic.confidence, HEURISTIC_CONFIDENCE_MAX),
    };
  }

  // Soft model result: keep model speaker, hedge confidence.
  return {
    speaker: modelSpeaker,
    confidence: Math.min(modelConfidence, 0.54),
  };
}
