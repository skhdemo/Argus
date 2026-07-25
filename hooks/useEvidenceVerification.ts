"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  findPrimaryClaim,
  isCompletedVerificationStatus,
  parseRetryAfterMs,
} from "@/hooks/evidenceVerificationQueue";
import type {
  ApiErrorBody,
  Claim,
  Evidence,
  EvidenceVerification,
  VerifyEvidenceRequest,
  VerifyEvidenceResponse,
} from "@/lib/types/debate";

export type EvidenceVerificationQueueStatus =
  | "queued"
  | "verifying"
  | "retrying"
  | "complete"
  | "error";

export type EvidenceVerificationQueueEntry = {
  status: EvidenceVerificationQueueStatus;
  /** Number of requests made in the current automatic/explicit attempt. */
  attempts: number;
  error: string | null;
};

export type EvidenceVerificationQueueState = Readonly<
  Record<string, EvidenceVerificationQueueEntry>
>;

export type UseEvidenceVerificationArgs = {
  evidence: Evidence[];
  claims: Claim[];
  updateEvidenceVerification: (
    evidenceId: string,
    verification: EvidenceVerification,
  ) => void;
};

export type UseEvidenceVerificationResult = {
  queueState: EvidenceVerificationQueueState;
  retry: (evidenceId: string) => void;
};

class VerificationRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter: string | null,
  ) {
    super(message);
    this.name = "VerificationRequestError";
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    return body.error || `Evidence verification failed (${response.status})`;
  } catch {
    return `Evidence verification failed (${response.status})`;
  }
}

export function useEvidenceVerification({
  evidence,
  claims,
  updateEvidenceVerification,
}: UseEvidenceVerificationArgs): UseEvidenceVerificationResult {
  const [queueState, setQueueState] =
    useState<Record<string, EvidenceVerificationQueueEntry>>({});

  const latestRef = useRef({ evidence, claims, updateEvidenceVerification });
  const pendingIdsRef = useRef<string[]>([]);
  const scheduledIdsRef = useRef(new Set<string>());
  const blockedIdsRef = useRef(new Set<string>());
  const terminalErrorIdsRef = useRef(new Set<string>());
  const retryCountsRef = useRef(new Map<string, number>());
  const lastStatusRef = useRef(new Map<string, Evidence["verification"]["status"]>());
  const retryTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const activeIdRef = useRef<string | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const pumpRef = useRef<() => void>(() => {});
  const enqueueRef = useRef<(evidenceId: string) => void>(() => {});

  useEffect(() => {
    latestRef.current = { evidence, claims, updateEvidenceVerification };
  }, [claims, evidence, updateEvidenceVerification]);

  const updateQueueEntry = useCallback(
    (
      evidenceId: string,
      patch: Partial<EvidenceVerificationQueueEntry>,
    ) => {
      if (!mountedRef.current) return;
      setQueueState((current) => {
        const previous = current[evidenceId] ?? {
          status: "queued",
          attempts: 0,
          error: null,
        };
        const next = { ...previous, ...patch };
        if (
          previous.status === next.status &&
          previous.attempts === next.attempts &&
          previous.error === next.error
        ) {
          return current;
        }
        return { ...current, [evidenceId]: next };
      });
    },
    [],
  );

  const markTerminalError = useCallback(
    (evidenceId: string, attempts: number, message: string) => {
      scheduledIdsRef.current.delete(evidenceId);
      blockedIdsRef.current.add(evidenceId);
      terminalErrorIdsRef.current.add(evidenceId);
      updateQueueEntry(evidenceId, {
        status: "error",
        attempts,
        error: message,
      });
    },
    [updateQueueEntry],
  );

  const pump = useCallback(() => {
    if (!mountedRef.current || activeIdRef.current !== null) return;

    const evidenceId = pendingIdsRef.current.shift();
    if (!evidenceId) return;

    const currentEvidence = latestRef.current.evidence.find(
      (item) => item.id === evidenceId,
    );
    if (
      !currentEvidence ||
      currentEvidence.verification.status !== "pending"
    ) {
      scheduledIdsRef.current.delete(evidenceId);
      pumpRef.current();
      return;
    }

    const primaryClaim = findPrimaryClaim(
      currentEvidence,
      latestRef.current.claims,
    );
    if (!primaryClaim) {
      markTerminalError(
        evidenceId,
        0,
        "Evidence has no current claim target",
      );
      pumpRef.current();
      return;
    }

    const controller = new AbortController();
    const priorRetries = retryCountsRef.current.get(evidenceId) ?? 0;
    const attempts = priorRetries + 1;
    activeIdRef.current = evidenceId;
    activeControllerRef.current = controller;
    updateQueueEntry(evidenceId, {
      status: "verifying",
      attempts,
      error: null,
    });

    void (async () => {
      try {
        const body: VerifyEvidenceRequest = {
          evidence: currentEvidence,
          claim: primaryClaim,
        };
        const response = await fetch("/api/verify-evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new VerificationRequestError(
            await readErrorMessage(response),
            response.status,
            response.headers.get("Retry-After"),
          );
        }

        const result = (await response.json()) as VerifyEvidenceResponse;
        if (result.evidenceId !== evidenceId) {
          throw new Error("Verification response evidence id did not match");
        }
        if (!mountedRef.current || controller.signal.aborted) return;

        scheduledIdsRef.current.delete(evidenceId);
        blockedIdsRef.current.add(evidenceId);
        terminalErrorIdsRef.current.delete(evidenceId);
        latestRef.current.updateEvidenceVerification(
          evidenceId,
          result.verification,
        );
        updateQueueEntry(evidenceId, {
          status: "complete",
          attempts,
          error: null,
        });
      } catch (error) {
        if (!mountedRef.current || controller.signal.aborted) return;

        if (error instanceof VerificationRequestError && error.status === 429) {
          if (priorRetries === 0) {
            retryCountsRef.current.set(evidenceId, 1);
            updateQueueEntry(evidenceId, {
              status: "retrying",
              attempts,
              error: null,
            });
            const timer = setTimeout(() => {
              retryTimersRef.current.delete(evidenceId);
              if (
                !mountedRef.current ||
                !scheduledIdsRef.current.has(evidenceId)
              ) {
                return;
              }
              pendingIdsRef.current.push(evidenceId);
              pumpRef.current();
            }, parseRetryAfterMs(error.retryAfter));
            retryTimersRef.current.set(evidenceId, timer);
            return;
          }
        }

        markTerminalError(
          evidenceId,
          attempts,
          error instanceof Error ? error.message : "Evidence verification failed",
        );
      } finally {
        if (activeIdRef.current === evidenceId) {
          activeIdRef.current = null;
          activeControllerRef.current = null;
        }
        pumpRef.current();
      }
    })();
  }, [markTerminalError, updateQueueEntry]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const enqueue = useCallback(
    (evidenceId: string) => {
      const item = latestRef.current.evidence.find(
        (candidate) => candidate.id === evidenceId,
      );
      if (
        !item ||
        item.verification.status !== "pending" ||
        blockedIdsRef.current.has(evidenceId) ||
        scheduledIdsRef.current.has(evidenceId)
      ) {
        return;
      }

      scheduledIdsRef.current.add(evidenceId);
      pendingIdsRef.current.push(evidenceId);
      retryCountsRef.current.set(evidenceId, 0);
      updateQueueEntry(evidenceId, {
        status: "queued",
        attempts: 0,
        error: null,
      });
      pumpRef.current();
    },
    [updateQueueEntry],
  );

  useEffect(() => {
    enqueueRef.current = enqueue;
  }, [enqueue]);

  useEffect(() => {
    const retryTimers = retryTimersRef.current;
    const scheduledIds = scheduledIdsRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
      activeIdRef.current = null;
      for (const timer of retryTimers.values()) {
        clearTimeout(timer);
      }
      retryTimers.clear();
      pendingIdsRef.current = [];
      scheduledIds.clear();
    };
  }, []);

  useEffect(() => {
    const currentIds = new Set(evidence.map((item) => item.id));

    for (const item of evidence) {
      const status = item.verification.status;
      const previousStatus = lastStatusRef.current.get(item.id);
      lastStatusRef.current.set(item.id, status);

      if (isCompletedVerificationStatus(status)) {
        blockedIdsRef.current.add(item.id);
        terminalErrorIdsRef.current.delete(item.id);
        scheduledIdsRef.current.delete(item.id);
        const timer = retryTimersRef.current.get(item.id);
        if (timer) clearTimeout(timer);
        retryTimersRef.current.delete(item.id);
        pendingIdsRef.current = pendingIdsRef.current.filter(
          (queuedId) => queuedId !== item.id,
        );
        if (activeIdRef.current === item.id) {
          activeControllerRef.current?.abort();
        }
        updateQueueEntry(item.id, {
          status: "complete",
          error: null,
        });
        continue;
      }

      if (status === "pending") {
        if (previousStatus && previousStatus !== "pending") {
          blockedIdsRef.current.delete(item.id);
          terminalErrorIdsRef.current.delete(item.id);
        }
        enqueueRef.current(item.id);
      }
    }

    for (const knownId of lastStatusRef.current.keys()) {
      if (currentIds.has(knownId)) continue;
      lastStatusRef.current.delete(knownId);
      blockedIdsRef.current.delete(knownId);
      terminalErrorIdsRef.current.delete(knownId);
      scheduledIdsRef.current.delete(knownId);
      retryCountsRef.current.delete(knownId);
      const timer = retryTimersRef.current.get(knownId);
      if (timer) clearTimeout(timer);
      retryTimersRef.current.delete(knownId);
      pendingIdsRef.current = pendingIdsRef.current.filter(
        (queuedId) => queuedId !== knownId,
      );
      if (activeIdRef.current === knownId) {
        activeControllerRef.current?.abort();
      }
    }
  }, [evidence, updateQueueEntry]);

  const retry = useCallback((evidenceId: string) => {
    const item = latestRef.current.evidence.find(
      (candidate) => candidate.id === evidenceId,
    );
    if (
      !item ||
      item.verification.status !== "pending" ||
      !terminalErrorIdsRef.current.has(evidenceId)
    ) {
      return;
    }

    const timer = retryTimersRef.current.get(evidenceId);
    if (timer) clearTimeout(timer);
    retryTimersRef.current.delete(evidenceId);
    pendingIdsRef.current = pendingIdsRef.current.filter(
      (queuedId) => queuedId !== evidenceId,
    );
    scheduledIdsRef.current.delete(evidenceId);
    blockedIdsRef.current.delete(evidenceId);
    terminalErrorIdsRef.current.delete(evidenceId);
    retryCountsRef.current.delete(evidenceId);
    enqueueRef.current(evidenceId);
  }, []);

  return { queueState, retry };
}
