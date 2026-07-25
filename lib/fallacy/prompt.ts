/**
 * Soft fallacy instructions for the extract call (BE2).
 * Fold into extract system prompt (one Gemini call) — BE1 reviews route/schema wiring.
 *
 * Fallacies attach ONLY to Claims. Never infer support status or verification.
 */

export const FALLACY_INSTRUCTIONS = `## Soft fallacy tags (not fact-checking, not support status)

For each NEW or UPDATED claim, you may set fallacies: zero or more of:
- ad_hominem — attacks the person instead of the claim
- strawman — misrepresents the opponent's position
- circular_reasoning — assumes what it tries to prove
- false_dilemma — presents only two options when more exist

Rules:
1. Prefer empty fallacies[] when unsure. Soft warnings only — no humiliation language.
2. Do NOT label truth/falsehood. Fallacies are rhetorical structure tags, not correctness.
3. Do NOT set unsupported, verification, or evidence status. Support is derived from Evidence attachments elsewhere.
4. Only use the four fallacy tags above.
5. Attach fallacies ONLY to Claims — never to Evidence.
6. Keep claim.text free of warning labels; put tags in fallacies fields only.`;
