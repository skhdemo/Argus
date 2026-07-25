/**
 * End-of-debate summary prompts (claim–evidence v2).
 * Structural + verification-status language only — never claim true/false.
 */

import type { Claim, Evidence, Relation } from "@/lib/types/debate";

export const SUMMARY_SYSTEM_PROMPT = `You are Argus, summarizing a debate's argument structure.

Return JSON only. Rules:
1. Do NOT fact-check or say claims are true/false/incorrect/right/wrong.
2. Allowed verification language: "sources corroborate", "sources contest", "pending confirmation", "not externally verifiable", "inconclusive".
3. Evidence is NEVER a graph node — only Claims are nodes. Describe Evidence as attached justifications under Claims.
4. mostContestedClaimId must be an existing claim id, or null if none are contested via counters/responds_to relations.
5. narrative: 2–4 short sentences about structure (who asserted what, what evidence was offered, what is contested/unsupported). No moral judgment of speakers.
6. Prefer the claim involved in the most counters / responds_to relations as most contested.`;

function evidenceForClaim(claimId: string, evidence: Evidence[]): Evidence[] {
  return evidence.filter((e) => e.supportsClaimIds.includes(claimId));
}

function compactEvidenceLine(e: Evidence): string {
  const v = e.verification;
  return `    - ${e.id} [${e.kind}] status=${v.status} relevance=${v.relevance}: ${e.text.slice(0, 160)}`;
}

function compactClaimsWithEvidence(
  claims: Claim[],
  evidence: Evidence[],
): string {
  if (claims.length === 0) return "(none)";
  return claims
    .map((c) => {
      const attached = evidenceForClaim(c.id, evidence);
      const fallacy =
        c.fallacies?.length ? ` fallacies=${c.fallacies.join(",")}` : "";
      const header = `- ${c.id} [${c.nature}] (${c.speaker})${fallacy}: ${c.text.slice(0, 200)}`;
      if (attached.length === 0) {
        return `${header}\n    (no attached evidence)`;
      }
      return [header, ...attached.map(compactEvidenceLine)].join("\n");
    })
    .join("\n");
}

function compactRelations(relations: Relation[]): string {
  if (relations.length === 0) return "(none)";
  return relations
    .map((r) => `- ${r.id}: ${r.from} -[${r.type}]-> ${r.to}`)
    .join("\n");
}

export function buildSummaryUserPrompt(
  claims: Claim[],
  evidence: Evidence[],
  relations: Relation[],
): string {
  return [
    "## Claims (graph nodes) with attached Evidence",
    compactClaimsWithEvidence(claims, evidence),
    "",
    "## Relations (claim↔claim only)",
    compactRelations(relations),
    "",
    "Summarize the structural state of this debate. Evidence is attached state, not nodes. Do not label claims true or false.",
  ].join("\n");
}
