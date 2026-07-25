/**
 * Soft fallacy / unsupported instructions for the extract call (BE2).
 * Fold into extract system prompt (one Gemini call) — BE1 reviews route/schema wiring.
 */

export const FALLACY_INSTRUCTIONS = `## Soft structure warnings (not fact-checking)

For each NEW claim, you may also set:
- unsupported: true when the claim is asserted without support in this chunk or the existing graph (soft warning — NOT "false")
- fallacies: zero or more of:
  - ad_hominem — attacks the person instead of the claim
  - strawman — misrepresents the opponent's position
  - circular_reasoning — assumes what it tries to prove
  - false_dilemma — presents only two options when more exist

Rules:
1. Prefer empty fallacies[] when unsure. Soft warnings only — no humiliation language.
2. Do NOT label truth/falsehood. unsupported means structurally unsupported, not incorrect.
3. Only use the four fallacy tags above.
4. Keep claim.text free of warning labels; put warnings in unsupported / fallacies fields.`;
