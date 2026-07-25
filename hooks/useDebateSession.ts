"use client";

import { useCallback, useState } from "react";

import type { Claim, Edge, ExtractResponse } from "@/lib/types/debate";
import { useMomentum, type MomentumState } from "@/hooks/useMomentum";

export type DebateSession = {
  claims: Claim[];
  edges: Edge[];
  selectedClaimId: string | null;
  selectClaim: (id: string | null) => void;
  mergeExtractResponse: (delta: ExtractResponse) => void;
  momentum: MomentumState;
};

function mergeById<T extends { id: string }>(prev: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return prev;
  const byId = new Map(prev.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values());
}

/**
 * Holds claims/edges + which claim is selected for the inspector. Does NOT
 * hold transcript state — that stays solely in useSpeechRecognition, so
 * there's only one source of truth for it.
 */
export function useDebateSession(): DebateSession {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const mergeExtractResponse = useCallback((delta: ExtractResponse) => {
    setClaims((prev) => mergeById(prev, delta.claims));
    setEdges((prev) => mergeById(prev, delta.edges));
  }, []);

  const selectClaim = useCallback((id: string | null) => {
    setSelectedClaimId(id);
  }, []);

  const momentum = useMomentum(claims);

  return { claims, edges, selectedClaimId, selectClaim, mergeExtractResponse, momentum };
}
