"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ApiErrorBody,
  Claim,
  Evidence,
  Relation,
  ScoreRequest,
  ScoreResponse,
} from "@/lib/types/debate";

/**
 * Threshold at which momentum reads as decisive enough to show an explicit
 * "Speaker X is winning" callout, rather than just a background lean.
 */
export const MOMENTUM_DECISIVE_THRESHOLD = 0.62;

export type MomentumState = {
  /** Share of "momentum mass" held by speaker A, 0..1. */
  ratioA: number;
  /** = 1 - ratioA. */
  ratioB: number;
  leader: "A" | "B" | "tied";
  /** max(ratioA, ratioB) — how lopsided the current lead is. */
  leaderShare: number;
  isDecisive: boolean;
};

export type UseMomentumResult = MomentumState & {
  isLoading: boolean;
  error: string | null;
};

const TIED: MomentumState = {
  ratioA: 0.5,
  ratioB: 0.5,
  leader: "tied",
  leaderShare: 0.5,
  isDecisive: false,
};

function toMomentumState(score: ScoreResponse): MomentumState {
  return {
    ratioA: score.ratioA,
    ratioB: score.ratioB,
    leader: score.leader,
    leaderShare: score.leaderShare,
    // The route owns threshold semantics; keep the exported constant aligned
    // for UI copy and visual affordances only.
    isDecisive: score.isDecisive,
  };
}

type MomentumInput = {
  claims: Claim[];
  evidence: Evidence[];
  relations: Relation[];
};

type ResolvedMomentum = {
  input: MomentumInput | null;
  score: MomentumState;
  error: string | null;
};

export function useMomentum(
  claims: Claim[],
  evidence: Evidence[],
  relations: Relation[],
): UseMomentumResult {
  const input = useMemo(
    () => ({ claims, evidence, relations }),
    [claims, evidence, relations],
  );
  const [resolved, setResolved] = useState<ResolvedMomentum>({
    input: null,
    score: TIED,
    error: null,
  });
  const requestIdRef = useRef(0);
  const isEmpty =
    claims.length === 0 && evidence.length === 0 && relations.length === 0;

  useEffect(() => {
    if (isEmpty) return;

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    let active = true;

    void (async () => {
      try {
        const body: ScoreRequest = { claims, evidence, relations };
        const response = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = (await response.json()) as ApiErrorBody;
          throw new Error(errorBody.error || "Scoring request failed");
        }

        const score = (await response.json()) as ScoreResponse;
        if (!active || requestId !== requestIdRef.current) return;
        setResolved({
          input,
          score: toMomentumState(score),
          error: null,
        });
      } catch (error) {
        if (
          !active ||
          controller.signal.aborted ||
          requestId !== requestIdRef.current
        ) {
          return;
        }
        setResolved((current) => ({
          input,
          score: current.score,
          error: error instanceof Error ? error.message : "Scoring request failed",
        }));
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [claims, evidence, input, isEmpty, relations]);

  if (isEmpty) {
    return { ...TIED, isLoading: false, error: null };
  }

  return {
    ...resolved.score,
    isLoading: resolved.input !== input,
    error: resolved.input === input ? resolved.error : null,
  };
}
