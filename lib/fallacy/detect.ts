/**
 * Fallacy helpers (BE2) — claim–evidence v2.
 *
 * Primary path: model fallacies from extract (one-call) via annotateClaimFallacies.
 * Fallback: structural cue heuristics when the model omits fallacy fields.
 *
 * Never infers support status, Claim nature changes, or Evidence verification.
 */

import type { Claim, FallacyTag } from "@/lib/extract/schema";

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

export type ModelClaimFallacyFields = {
  clientId: string;
  fallacies?: FallacyTag[];
};

/**
 * Merge model fallacy fields onto normalized claims via clientId map.
 * Index is used only as a fallback when clientId is unknown.
 * Does not touch support-related fields (nature, evidence, verification).
 */
export function annotateClaimFallacies(input: {
  claims: Claim[];
  /** clientId → soft fallacy payload from the model (preferred) */
  modelByClientId?: Map<string, { fallacies?: unknown }>;
  /**
   * Parallel to model.claims before id remap; used only when
   * modelByClientId is absent or misses an entry. Prefer clientId map.
   */
  modelSoft?: Array<{ clientId?: string; fallacies?: unknown }>;
  /** clientId for each claim in `claims` (same order as normalize output) */
  claimClientIds?: string[];
}): Claim[] {
  return input.claims.map((claim, index) => {
    const clientId = input.claimClientIds?.[index];
    const fromMap =
      clientId && input.modelByClientId
        ? input.modelByClientId.get(clientId)
        : undefined;
    const soft =
      fromMap ??
      (clientId
        ? input.modelSoft?.find((s) => s.clientId === clientId)
        : undefined) ??
      input.modelSoft?.[index];

    // Only treat fallacies as model-provided when the key is present (even if []).
    const modelProvidedFallacies =
      soft != null &&
      Object.prototype.hasOwnProperty.call(soft, "fallacies");
    const fromModel = normalizeFallacies(soft?.fallacies);
    const fallacies = modelProvidedFallacies
      ? fromModel
      : (() => {
          const heuristic = heuristicFallacies(claim.text);
          return heuristic.length > 0 ? heuristic : undefined;
        })();

    if (!fallacies?.length) {
      if (claim.fallacies === undefined) return claim;
      return { ...claim, fallacies: undefined };
    }

    return {
      ...claim,
      fallacies,
    };
  });
}

/** @deprecated Use annotateClaimFallacies — kept as alias for route migration. */
export const annotateClaimsSoftFlags = annotateClaimFallacies;

export { FALLACY_INSTRUCTIONS } from "@/lib/fallacy/prompt";
