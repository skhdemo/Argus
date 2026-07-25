/**
 * Extraction system + user prompt builders (BE1).
 *
 * ONE Gemini call: extract + speaker + soft fallacy tags.
 * Route appends SPEAKER_INSTRUCTIONS and FALLACY_INSTRUCTIONS.
 * Verification / Google Search must NEVER run on this path.
 */

import type {
  Claim,
  Evidence,
  ExtractRequest,
  Relation,
} from "@/lib/extract/schema";

export const EXTRACT_SYSTEM_PROMPT = `You are Argus, a debate structure extractor.

Given new transcript text and the existing claim / evidence / relation graph, extract ONLY structural updates:
- New or updated Claims (atomic debatable conclusions)
- New or updated Evidence (speaker-provided justifications — NEVER graph nodes)
- New Relations of type counters | responds_to (claim↔claim ONLY)

## Ontology (strict)

Claim = a conclusion that can stand as a debatable point (nature: argument | counterargument).
Evidence = the speaker-provided reason, statistic, citation, example, anecdote, authority, or reasoning that supports a Claim.
Relation = claim-to-claim link only. Evidence support is NEVER a relation — it is Evidence.supportsClaimIds / targetClaimRefs.

## FORBIDDEN

1. Do NOT turn evidence-only facts into Claim nodes.
2. Do NOT emit a "supports" relation. Support lives on Evidence only.
3. Do NOT verify, search the web, fact-check, or label truth/falsehood.
4. Do NOT invent verification status, relevance, or sources.
5. Do NOT put Evidence IDs in Relation from/to.

## Because-pattern (required)

When a speaker says "CONCLUSION because JUSTIFICATION":
- CONCLUSION → one Claim
- JUSTIFICATION → one Evidence attached to that Claim via targetClaimRefs
- Do NOT create a second Claim for the justification

Example (CORRECT):
Transcript: "Messi is better because he won a World Cup and two Copa Américas."
→ claims: [{ clientId: "n1", text: "Messi is better", nature: "argument", ... }]
→ evidence: [{ clientId: "e1", text: "He won a World Cup and two Copa Américas", kind: "factual_claim", targetClaimRefs: ["n1"], ... }]
→ relations: []

Example (WRONG — never do this):
→ two claims linked by a "supports" edge for the World Cup fact.

## Rules

1. Return JSON only matching the schema. No markdown.
2. Prefer linking to existingClaims / existingEvidence by id. Do not duplicate near-identical items.
3. Every NEW claim/evidence must include a short clientId like "n1", "e1" (unique within this response).
4. Use updateClaimId / updateEvidenceId when the speaker clarifies or extends an existing item instead of duplicating it.
5. Relation from/to must be an existing claim id (c_…) OR a claim clientId from this response — never an evidence id (ev_…) or evidence clientId.
6. Evidence targetClaimRefs must be one or more existing claim ids OR claim clientIds from this response (non-empty).
7. nature:
   - argument: a standalone position
   - counterargument: opposes another claim — MUST also emit a counters or responds_to relation to that target
8. Evidence kind: statistic | citation | factual_claim | example | anecdote | reasoning | authority
9. inferredSpeaker: best guess A | B | UNKNOWN for who spoke the new chunk.
10. speakerConfidence: 0–1. Use ≤0.5 when unsure.
11. Keep claim/evidence text concise (one sentence when possible).
12. If the chunk adds nothing structural, return empty claims, evidence, and relations arrays.
13. Optional fallacies[] on Claims only (soft tags). Never on Evidence.`;

function compactClaims(claims: Claim[]): string {
  if (claims.length === 0) return "(none)";
  return claims
    .map(
      (c) =>
        `- ${c.id} [${c.nature}] (${c.speaker}): ${c.text.slice(0, 160)}`,
    )
    .join("\n");
}

function compactEvidence(evidence: Evidence[]): string {
  if (evidence.length === 0) return "(none)";
  return evidence
    .map(
      (e) =>
        `- ${e.id} [${e.kind}] (${e.speaker}) → [${e.supportsClaimIds.join(", ")}]: ${e.text.slice(0, 160)}`,
    )
    .join("\n");
}

function compactRelations(relations: Relation[]): string {
  if (relations.length === 0) return "(none)";
  return relations
    .map((r) => `- ${r.id}: ${r.from} -[${r.type}]-> ${r.to}`)
    .join("\n");
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
    "## Existing evidence",
    compactEvidence(req.existingEvidence),
    "",
    "## Existing relations",
    compactRelations(req.existingRelations),
    "",
    "## Client speaker hint",
    hint,
    "",
    ...(typeof req.pauseMs === "number"
      ? ["## Pause since last chunk (ms)", String(req.pauseMs), ""]
      : []),
    ...(window
      ? ["## Recent transcript window", window.slice(0, 4000), ""]
      : []),
    "## New transcript chunk",
    req.text.slice(0, 6000),
    "",
    "Extract structural deltas for this chunk. Remember: conclusions are Claims; justifications are Evidence; never evidence-as-claim.",
  ].join("\n");
}
