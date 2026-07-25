/**
 * Fallacy + unsupported helpers (BE2).
 *
 * Primary path: model fields from extract (one-call) via annotateClaimsFromModel.
 * Fallback: structural heuristics when the model omits soft flags.
 */

import type { Claim, Edge, FallacyTag } from "@/lib/types/debate";

const FALLACY_TAGS: readonly FallacyTag[] = [
  "ad_hominem",
  "strawman",
  "circular_reasoning",
  "false_dilemma",
] as const;

const CUE_PATTERNS: { tag: FallacyTag; re: RegExp }[] = [
  {
    tag: "ad_hominem",
    re: /\b(you('re| are) (stupid|dumb|naive|ignorant)|only an idiot|shut up)\b/i,
  },
  {
    tag: "strawman",
    re: /\b(so you('re| are) saying|what you really mean is)\b/i,
  },
  {
    tag: "circular_reasoning",
    re: /\b(because (it('| i)s true|that's just how it is)|true because)\b/i,
  },
  {
    tag: "false_dilemma",
    re: /\b(either .+ or |only two (choices|options)|you('re| are) either)\b/i,
  },
];

export function isFallacyTag(value: unknown): value is FallacyTag {
  return (
    typeof value === "string" &&
    (FALLACY_TAGS as readonly string[]).includes(value)
  );
}

export function normalizeFallacies(value: unknown): FallacyTag[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const tags = value.filter(isFallacyTag);
  return tags.length > 0 ? [...new Set(tags)] : undefined;
}

/** Cue-based soft tags — never invent strong certainty; empty when unsure. */
export function heuristicFallacies(text: string): FallacyTag[] {
  const hits: FallacyTag[] = [];
  for (const { tag, re } of CUE_PATTERNS) {
    if (re.test(text)) hits.push(tag);
  }
  return hits;
}

export function claimLooksUnsupported(
  claim: Claim,
  edges: Edge[],
  existingEdges: Edge[] = [],
): boolean {
  if (claim.unsupported) return true;
  const all = [...existingEdges, ...edges];
  const hasSupport = all.some(
    (e) => e.type === "supports" && e.to === claim.id,
  );
  // Assumptions stay typed as assumption (distinct styling later) — do not
  // auto-promote them to unsupported unless the model set the flag.
  if (claim.type === "needs_evidence" && !hasSupport) return true;
  return false;
}

export type ModelClaimSoftFields = {
  clientId: string;
  unsupported?: boolean;
  fallacies?: FallacyTag[];
};

/**
 * Merge model soft fields onto normalized claims (by order / clientId map).
 * Applies structural unsupported + light cue heuristics as fallback.
 */
export function annotateClaimsSoftFlags(input: {
  claims: Claim[];
  edges: Edge[];
  existingEdges?: Edge[];
  /** Parallel to model.claims before id remap; matched by index when lengths equal */
  modelSoft?: Array<{ unsupported?: boolean; fallacies?: unknown }>;
}): Claim[] {
  const existingEdges = input.existingEdges ?? [];

  return input.claims.map((claim, index) => {
    const soft = input.modelSoft?.[index];
    const modelProvidedFallacies = soft != null && "fallacies" in soft;
    const fromModel = normalizeFallacies(soft?.fallacies);
    // If the model included fallacies (even []), trust that and skip cues.
    const fallacies = modelProvidedFallacies
      ? fromModel
      : (() => {
          const heuristic = heuristicFallacies(claim.text);
          return heuristic.length > 0 ? heuristic : undefined;
        })();

    const unsupported =
      soft?.unsupported === true ||
      claimLooksUnsupported(
        { ...claim, unsupported: soft?.unsupported, fallacies },
        input.edges,
        existingEdges,
      );

    return {
      ...claim,
      ...(unsupported ? { unsupported: true } : {}),
      ...(fallacies?.length ? { fallacies } : {}),
    };
  });
}

export { FALLACY_INSTRUCTIONS } from "@/lib/fallacy/prompt";
