/**
 * Prompts for two-pass Evidence verification.
 * Pass 1: grounded prose with Google Search (no JSON schema).
 * Pass 2: structured JSON using only server-allowlisted source URIs.
 */

import type { Claim, Evidence, SourceLink } from "@/lib/types/debate";

export const VERIFY_GROUNDED_SYSTEM_PROMPT = `You are Argus Evidence Corroborator.

Task: Use Google Search to check whether independent web sources align with the speaker-provided Evidence text, and how relevant that Evidence is to the given Claim.

Rules:
1. Describe SOURCE ALIGNMENT only. Never say the Claim is true or false.
2. Prefer language like "sources corroborate", "sources contest", "insufficient sources", or "not externally verifiable".
3. Focus on the Evidence text first; use the Claim only for relevance.
4. Do not invent citations. Rely on Search grounding.
5. Write a concise grounded assessment in plain prose (no JSON).`;

export function buildGroundedUserPrompt(
  evidence: Evidence,
  claim: Claim,
): string {
  return [
    "## Claim (for relevance only)",
    `id: ${claim.id}`,
    `nature: ${claim.nature}`,
    `text: ${claim.text}`,
    "",
    "## Evidence to check",
    `id: ${evidence.id}`,
    `kind: ${evidence.kind}`,
    `text: ${evidence.text}`,
    "",
    "Search the web and assess whether grounded sources align with the Evidence, and how relevant the Evidence is to the Claim. Do not label the Claim true or false.",
  ].join("\n");
}

export const VERIFY_STRUCTURED_SYSTEM_PROMPT = `You are Argus Evidence Corroborator (structured pass).

Convert the grounded assessment into JSON matching the schema.

Rules:
1. status must be one of: corroborated | contested | inconclusive | not_verifiable
2. relevance must be one of: strong | moderate | weak | irrelevant | pending
3. summary must describe source alignment — NEVER claim true/false.
4. sourceUris may ONLY be chosen from the provided allowlist. Do not invent URLs.
5. If the allowlist is empty, status cannot be corroborated — use inconclusive or not_verifiable.
6. Return JSON only.`;

export function buildStructuredUserPrompt(input: {
  groundedProse: string;
  allowlist: SourceLink[];
  evidenceText: string;
  claimText: string;
}): string {
  const allowlistBlock =
    input.allowlist.length === 0
      ? "(empty — no grounded sources; corroborated is forbidden)"
      : input.allowlist
          .map(
            (s, i) =>
              `${i + 1}. ${s.uri}${s.title ? ` — ${s.title}` : ""}${s.domain ? ` (${s.domain})` : ""}`,
          )
          .join("\n");

  return [
    "## Claim text (relevance only)",
    input.claimText,
    "",
    "## Evidence text",
    input.evidenceText,
    "",
    "## Grounded assessment prose",
    input.groundedProse.slice(0, 8000),
    "",
    "## Allowlisted source URIs (ONLY these may appear in sourceUris)",
    allowlistBlock,
    "",
    "Produce structured JSON for verification status, relevance, confidence, summary, and selected sourceUris.",
  ].join("\n");
}
