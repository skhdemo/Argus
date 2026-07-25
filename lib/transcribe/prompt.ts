/**
 * Gemini audio transcription + speaker diarization prompts (BE1).
 */

import type { SpeakerId } from "@/lib/types/debate";

export const TRANSCRIBE_SYSTEM_PROMPT = `You are Argus speech transcription for a live two-person debate.

Listen to the audio and return structured JSON only:
- Transcribe spoken English accurately.
- Diarize speakers as A or B (or UNKNOWN if unclear).
- Keep Speaker A and Speaker B consistent with prior context when provided.
- Ignore pure silence / noise — return empty segments if nobody spoke.
- Do NOT extract debate claims here — transcription and speaker labels only.
- Prefer short segments (one turn or clause).`;

export function buildTranscribeUserPrompt(opts: {
  lastSpeaker?: SpeakerId | null;
}): string {
  const last =
    opts.lastSpeaker === undefined || opts.lastSpeaker === null
      ? "(none)"
      : opts.lastSpeaker;

  return [
    "Transcribe this debate audio chunk with speaker diarization.",
    `Last known speaker hint: ${last}`,
    "Label the two debate participants as Speaker A and Speaker B.",
    "If only one person spoke, still assign A or B using the hint and turn-taking.",
    "Return segments in chronological order.",
  ].join("\n");
}
