import type {
  Claim,
  Evidence,
  ExtractResponse,
  Relation,
} from "@/lib/types/debate";

export type DebateGraphState = {
  claims: Claim[];
  evidence: Evidence[];
  relations: Relation[];
};

export const EMPTY_DEBATE_GRAPH: DebateGraphState = {
  claims: [],
  evidence: [],
  relations: [],
};

export function mergeById<T extends { id: string }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  if (incoming.length === 0) return current.slice();

  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values());
}

/**
 * Merges an extraction delta while keeping Evidence and Relations safe for
 * graph rendering even if an API response is malformed or internally stale.
 */
export function mergeExtractDelta(
  current: DebateGraphState,
  delta: ExtractResponse,
): DebateGraphState {
  const claims = mergeById(current.claims, delta.claims);
  const claimIds = new Set(claims.map((claim) => claim.id));

  const validEvidence = delta.evidence.flatMap((item) => {
    const supportsClaimIds = Array.from(
      new Set(item.supportsClaimIds.filter((id) => claimIds.has(id))),
    );
    return supportsClaimIds.length > 0 ? [{ ...item, supportsClaimIds }] : [];
  });

  const validRelations = delta.relations.filter(
    (relation) =>
      relation.from !== relation.to &&
      !relation.from.startsWith("ev_") &&
      !relation.to.startsWith("ev_") &&
      claimIds.has(relation.from) &&
      claimIds.has(relation.to),
  );

  return {
    claims,
    evidence: mergeById(current.evidence, validEvidence),
    relations: mergeById(current.relations, validRelations),
  };
}
