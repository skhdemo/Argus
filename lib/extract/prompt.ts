/**
 * Extraction system + user prompt builders (BE1).
 *
 * Decision (B3.2.3 — BE2 proposal, awaiting BE1 ack): ONE Gemini call.
 * Route appends `SPEAKER_INSTRUCTIONS` from `lib/speaker/prompt.ts` to the
 * system instruction. Prefer keeping speaker prose in lib/speaker/* so BE2
 * can iterate without rewriting the core extract rules above.
 */

import type { Claim, Edge, ExtractRequest } from "@/lib/types/debate";

export const EXTRACT_SYSTEM_PROMPT = `You are Argus, a debate structure extractor.

Given new transcript text and the existing claim/edge graph, extract ONLY structural updates:
- New claims (atomic propositional statements)
- New evidence framed as claims that support other claims
- New edges of type supports | contradicts | responds_to

Rules:
1. Return JSON only matching the schema. No markdown.
2. Do NOT fact-check or label truth/falsehood.
3. Prefer linking to existingClaims by their id. Do not duplicate near-identical claims.
4. Every NEW claim must include a short clientId like "n1", "n2" (unique within this response).
5. Edge from/to must be either an existing claim id OR a clientId from this response.
6. Assign claim.type:
   - supported: claim backed by evidence in the graph or this chunk
   - assumption: taken as given without support
   - needs_evidence: asserted but unsupported
   - counterargument: opposes another claim
7. inferredSpeaker: best guess A | B | UNKNOWN for who spoke the new chunk (stub-quality OK).
8. speakerConfidence: 0–1. Use ≤0.5 when unsure.
9. Keep claim text concise (one sentence when possible).
10. If the chunk adds nothing structural, return empty claims and edges arrays.`;

function compactClaims(claims: Claim[]): string {
  if (claims.length === 0) return "(none)";
  return claims
    .map(
      (c) =>
        `- ${c.id} [${c.type}] (${c.speaker}): ${c.text.slice(0, 160)}`,
    )
    .join("\n");
}

function compactEdges(edges: Edge[]): string {
  if (edges.length === 0) return "(none)";
  return edges.map((e) => `- ${e.id}: ${e.from} -[${e.type}]-> ${e.to}`).join("\n");
}

export function buildExtractUserPrompt(req: ExtractRequest): string {
  const window = req.transcriptWindow?.trim();
  const hint =
    req.inferredSpeaker === undefined || req.inferredSpeaker === null
      ? "(none)"
      : req.inferredSpeaker;

  return [
    "## Existing claims",
    compactClaims(req.existingClaims),
    "",
    "## Existing edges",
    compactEdges(req.existingEdges),
    "",
    "## Client speaker hint",
    hint,
    "",
    ...(window
      ? ["## Recent transcript window", window.slice(0, 4000), ""]
      : []),
    "## New transcript chunk",
    req.text.slice(0, 6000),
    "",
    "Extract structural deltas for this chunk.",
  ].join("\n");
}
