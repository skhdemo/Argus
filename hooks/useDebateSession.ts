"use client";

import { useCallback, useMemo, useState } from "react";

import {
  EMPTY_DEBATE_GRAPH,
  mergeExtractDelta,
  type DebateGraphState,
} from "@/hooks/debateState";
import { useMomentum, type UseMomentumResult } from "@/hooks/useMomentum";
import type {
  Claim,
  Evidence,
  EvidenceVerification,
  ExtractResponse,
  Relation,
} from "@/lib/types/debate";

export type DebateSession = {
  claims: Claim[];
  evidence: Evidence[];
  relations: Relation[];
  selectedClaimId: string | null;
  selectedClaim: Claim | null;
  claimById: ReadonlyMap<string, Claim>;
  evidenceById: ReadonlyMap<string, Evidence>;
  evidenceByClaimId: ReadonlyMap<string, readonly Evidence[]>;
  relationsByClaimId: ReadonlyMap<string, readonly Relation[]>;
  selectClaim: (id: string | null) => void;
  mergeExtractResponse: (delta: ExtractResponse) => void;
  updateEvidenceVerification: (
    evidenceId: string,
    verification: EvidenceVerification,
  ) => void;
  momentum: UseMomentumResult;
};

/**
 * Holds the claim/evidence graph and inspector selection. Transcript and
 * verification queue state intentionally live in their dedicated hooks.
 */
export function useDebateSession(): DebateSession {
  const [graph, setGraph] = useState<DebateGraphState>(EMPTY_DEBATE_GRAPH);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const mergeExtractResponse = useCallback((delta: ExtractResponse) => {
    setGraph((current) => mergeExtractDelta(current, delta));
  }, []);

  const selectClaim = useCallback((id: string | null) => {
    setSelectedClaimId(id);
  }, []);

  const updateEvidenceVerification = useCallback(
    (evidenceId: string, verification: EvidenceVerification) => {
      setGraph((current) => {
        const index = current.evidence.findIndex((item) => item.id === evidenceId);
        if (index < 0) return current;

        const evidence = current.evidence.slice();
        evidence[index] = { ...evidence[index], verification };
        return { ...current, evidence };
      });
    },
    [],
  );

  const indexes = useMemo(() => {
    const claimById = new Map(graph.claims.map((claim) => [claim.id, claim]));
    const evidenceById = new Map(
      graph.evidence.map((item) => [item.id, item]),
    );
    const evidenceByClaimId = new Map<string, Evidence[]>();
    for (const item of graph.evidence) {
      for (const claimId of item.supportsClaimIds) {
        const attached = evidenceByClaimId.get(claimId);
        if (attached) attached.push(item);
        else evidenceByClaimId.set(claimId, [item]);
      }
    }

    const relationsByClaimId = new Map<string, Relation[]>();
    for (const relation of graph.relations) {
      for (const claimId of new Set([relation.from, relation.to])) {
        const attached = relationsByClaimId.get(claimId);
        if (attached) attached.push(relation);
        else relationsByClaimId.set(claimId, [relation]);
      }
    }

    return { claimById, evidenceById, evidenceByClaimId, relationsByClaimId };
  }, [graph]);

  const selectedClaim = selectedClaimId
    ? (indexes.claimById.get(selectedClaimId) ?? null)
    : null;

  const momentum = useMomentum(
    graph.claims,
    graph.evidence,
    graph.relations,
  );

  return {
    ...graph,
    selectedClaimId,
    selectedClaim,
    ...indexes,
    selectClaim,
    mergeExtractResponse,
    updateEvidenceVerification,
    momentum,
  };
}
