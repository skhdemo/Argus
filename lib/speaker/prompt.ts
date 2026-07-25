/**
 * Speaker / turn-boundary instructions (BE2).
 *
 * Hackathon default (B3.2.3): ONE Gemini call — append these to BE1's extract
 * system prompt rather than a second generateContent.
 */

export const SPEAKER_INSTRUCTIONS = `## Speaker / turn inference

You are also labeling who spoke the new transcript chunk in a two-person debate.
Participants are only Speaker A and Speaker B. Mic audio is diarized by Gemini STT —

infer turns from content and context (client hint + continuity).

Rules:
1. Prefer continuity: if the new text continues the same argument/voice, keep the
   client speaker hint (or prior speaker) with higher confidence.
2. Flip speaker on clear turn cues: disagreement, rebuttal, "you said", addressing
   the other person, sharp topic pivot after a pause.
3. If unsure, use UNKNOWN or keep the prior speaker with confidence < 0.55.
   Never invent high confidence.
4. Do NOT fact-check claims. Speaker ID only.
5. Confidence guide:
   - 0.75–1.0 clear turn or clear continuity
   - 0.55–0.74 plausible but soft
   - < 0.55 hedge (UI will show "?")
   - UNKNOWN if you cannot tell

Set top-level inferredSpeaker and speakerConfidence for the new chunk.
Per-claim speaker should match the speaker of that claim's source text.`;

/** Slice for user prompt if BE1 prefers not to grow the system prompt. */
export function buildSpeakerUserPromptSlice(input: {
  lastSpeaker?: string | null;
  pauseMs?: number;
}): string {
  const last =
    input.lastSpeaker === undefined || input.lastSpeaker === null
      ? "UNKNOWN"
      : input.lastSpeaker;
  const pause =
    typeof input.pauseMs === "number" && Number.isFinite(input.pauseMs)
      ? `${Math.round(input.pauseMs)}ms`
      : "(not provided)";

  return [
    "## Speaker context (BE2)",
    `last_speaker: ${last}`,
    `pause_before_chunk: ${pause}`,
  ].join("\n");
}
