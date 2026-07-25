/**
 * End-of-debate summary prompts (BE2).
 * Structural only — never fact-check or label truth/falsehood.
 */

import type { Claim, Edge } from "@/lib/types/debate";

export const SUMMARY_SYSTEM_PROMPT = `You are Argus, summarizing a debate's argument structure.

Return JSON only. Rules:
1. Do NOT fact-check or say claims are true/false/incorrect.
2. Use structural language only: unsupported, contested, supported, assumption.
3. mostContestedClaimId must be an existing claim id, or null if none are contested.
4. narrative: 2–4 short sentences about structure (who asserted what kinds of claims, what is contested/unsupported). No moral judgment of speakers.
5. Prefer the claim involved in the most contradicts / responds_to edges as most contested.`;

function compactClaims(claims: Claim[]): string {
  if (claims.length === 0) return "(none)";
  return claims
    .map(
      (c) =>
        `- ${c.id} [${c.type}] (${c.speaker})${c.unsupported ? " unsupported" : ""}${
          c.fallacies?.length ? ` fallacies=${c.fallacies.join(",")}` : ""
        }: ${c.text.slice(0, 200)}`,
    )
    .join("\n");
}

function compactEdges(edges: Edge[]): string {
  if (edges.length === 0) return "(none)";
  return edges.map((e) => `- ${e.id}: ${e.from} -[${e.type}]-> ${e.to}`).join("\n");
}

export function buildSummaryUserPrompt(claims: Claim[], edges: Edge[]): string {
  return [
    "## Claims",
    compactClaims(claims),
    "",
    "## Edges",
    compactEdges(edges),
    "",
    "Summarize the structural state of this debate graph.",
  ].join("\n");
}
