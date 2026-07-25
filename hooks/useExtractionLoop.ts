"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ApiErrorBody,
  Claim,
  Evidence,
  ExtractRequest,
  ExtractResponse,
  Relation,
  SpeakerId,
} from "@/lib/types/debate";

import claimOnlyFixture from "@/lib/extract/fixtures/claim-only.json";
import contestedEvidenceFixture from "@/lib/extract/fixtures/contested-evidence.json";
import contradictEdgeFixture from "@/lib/extract/fixtures/contradict-edge.json";
import messiEvidenceFixture from "@/lib/extract/fixtures/messi-evidence.json";
import notVerifiableAnecdoteFixture from "@/lib/extract/fixtures/not-verifiable-anecdote.json";
import supportEdgeFixture from "@/lib/extract/fixtures/support-edge.json";

const DEBOUNCE_MS = 3000;
const CHAR_THRESHOLD = 80;

export type FixtureName =
  | "claim-only"
  | "support-edge"
  | "contradict-edge"
  | "messi-evidence"
  | "contested-evidence"
  | "not-verifiable-anecdote";

const FIXTURES: Record<FixtureName, ExtractResponse> = {
  "claim-only": claimOnlyFixture as ExtractResponse,
  "support-edge": supportEdgeFixture as ExtractResponse,
  "contradict-edge": contradictEdgeFixture as ExtractResponse,
  "messi-evidence": messiEvidenceFixture as ExtractResponse,
  "contested-evidence": contestedEvidenceFixture as ExtractResponse,
  "not-verifiable-anecdote": notVerifiableAnecdoteFixture as ExtractResponse,
};

export type ExtractionLoopStatus = "idle" | "pending" | "error";

export type UseExtractionLoopArgs = {
  isListening: boolean;
  /** Full accumulated final transcript from Gemini STT. */
  transcriptFinal: string;
  existingClaims: Claim[];
  existingEvidence: Evidence[];
  existingRelations: Relation[];
  inferredSpeaker: SpeakerId | null;
  onDelta: (delta: ExtractResponse) => void;
};

export type UseExtractionLoopResult = {
  status: ExtractionLoopStatus;
  errorMessage: string | null;
  dismissError: () => void;
  /** Dev-only: feed one of BE1's fixtures through the same merge path as a live response. */
  injectFixture: (name: FixtureName) => void;
};

export function useExtractionLoop({
  isListening,
  transcriptFinal,
  existingClaims,
  existingEvidence,
  existingRelations,
  inferredSpeaker,
  onDelta,
}: UseExtractionLoopArgs): UseExtractionLoopResult {
  const [status, setStatus] = useState<ExtractionLoopStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Char offset into transcriptFinal already sent to the API. Only advances
  // on a successful response, so a failed call's text is naturally retried
  // (prepended to whatever's new) on the next trigger instead of being lost.
  const sentUpToRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id: a response is only applied if no newer call has fired
  // since it went out, guarding against a slow call resolving after a
  // faster, more recent one already landed.
  const requestIdRef = useRef(0);

  // Keep latest values in a ref so the debounce timer's callback always sees
  // current data without needing to be re-created on every keystroke. Synced
  // in an effect (not during render) — refs must not be written mid-render.
  const latestRef = useRef({
    existingClaims,
    existingEvidence,
    existingRelations,
    inferredSpeaker,
    onDelta,
    transcriptFinal,
  });
  useEffect(() => {
    latestRef.current = {
      existingClaims,
      existingEvidence,
      existingRelations,
      inferredSpeaker,
      onDelta,
      transcriptFinal,
    };
  });

  const fireNow = useCallback(async (text: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const sentEnd = sentUpToRef.current + text.length;
    const myRequestId = ++requestIdRef.current;
    const {
      existingClaims,
      existingEvidence,
      existingRelations,
      inferredSpeaker,
      onDelta,
      transcriptFinal,
    } = latestRef.current;

    setStatus("pending");
    try {
      const body: ExtractRequest = {
        text,
        transcriptWindow: transcriptFinal,
        inferredSpeaker,
        existingClaims,
        existingEvidence,
        existingRelations,
      };
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (myRequestId !== requestIdRef.current) return; // superseded by a newer call

      if (!res.ok) {
        const body = (await res.json()) as ApiErrorBody;
        setStatus("error");
        setErrorMessage(body.error);
        return; // sentUpToRef intentionally NOT advanced — retried next trigger
      }

      const delta = (await res.json()) as ExtractResponse;
      sentUpToRef.current = sentEnd;
      onDelta(delta);
      setStatus("idle");
    } catch (err) {
      if (myRequestId !== requestIdRef.current) return;
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Extraction request failed");
    }
  }, []);

  useEffect(() => {
    if (!isListening) return;

    const pending = transcriptFinal.slice(sentUpToRef.current);
    if (!pending) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (pending.length >= CHAR_THRESHOLD) {
      void fireNow(pending);
    } else {
      timerRef.current = setTimeout(() => {
        void fireNow(pending);
      }, DEBOUNCE_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [transcriptFinal, isListening, fireNow]);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
    setStatus("idle");
  }, []);

  const injectFixture = useCallback((name: FixtureName) => {
    latestRef.current.onDelta(FIXTURES[name]);
  }, []);

  return { status, errorMessage, dismissError, injectFixture };
}
