/**
 * Delta merge helpers (BE1).
 *
 * Merge semantics:
 * - Server returns deltas only (new/updated claims + new edges).
 * - Client merges by `id`.
 * - Updates to an existing claim reuse the same id (rare; model usually emits new clientIds).
 * - Stable ids: `c_<uuid>` / `e_<uuid>`.
 */

import { randomUUID } from "crypto";

import type { Claim, Edge, ExtractResponse, SpeakerId } from "@/lib/types/debate";
import type { ModelExtract } from "@/lib/extract/schema";

export function newClaimId(): string {
  return `c_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function newEdgeId(): string {
  return `e_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/**
 * Map model output (clientIds) → ExtractResponse deltas with stable ids.
 * Drops edges that reference unknown endpoints.
 */
export function normalizeModelExtract(
  model: ModelExtract,
  opts?: {
    inferredSpeaker?: SpeakerId | null;
    /** When true, prefer stub speaker fields (pre-BE2 wire). */
    stubSpeaker?: boolean;
  },
): ExtractResponse {
  const now = Date.now();
  const idByClient = new Map<string, string>();

  const claims: Claim[] = model.claims.map((c) => {
    const id = newClaimId();
    idByClient.set(c.clientId, id);
    return {
      id,
      text: c.text.trim(),
      speaker: c.speaker,
      type: c.type,
      sourceExcerpt: c.sourceExcerpt,
      ...(c.unsupported === true ? { unsupported: true } : {}),
      ...(c.fallacies && c.fallacies.length > 0
        ? { fallacies: c.fallacies }
        : {}),
      createdAt: now,
    };
  });

  const resolve = (ref: string): string | null => {
    if (idByClient.has(ref)) return idByClient.get(ref)!;
    // Existing graph ids (c_...) pass through
    if (ref.startsWith("c_")) return ref;
    return null;
  };

  const edges: Edge[] = [];
  for (const e of model.edges) {
    const from = resolve(e.from);
    const to = resolve(e.to);
    if (!from || !to || from === to) continue;
    edges.push({
      id: newEdgeId(),
      from,
      to,
      type: e.type,
    });
  }

  // BE2: replace stub with inferSpeaker(...) from lib/speaker/infer.ts
  const stub = opts?.stubSpeaker !== false;
  const inferredSpeaker: SpeakerId = stub
    ? (opts?.inferredSpeaker ?? model.inferredSpeaker ?? "UNKNOWN")
    : model.inferredSpeaker;
  const speakerConfidence = stub
    ? (opts?.inferredSpeaker ? 0.5 : model.speakerConfidence ?? 0.5)
    : model.speakerConfidence;

  return {
    claims,
    edges,
    inferredSpeaker,
    speakerConfidence,
    notes: model.notes,
  };
}
