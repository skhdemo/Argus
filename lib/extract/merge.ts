/**
 * Delta merge helpers (BE1) — claim–evidence v2.
 *
 * Merge semantics:
 * - Server returns deltas only (new/updated claims + evidence + new relations).
 * - Client merges by `id`.
 * - updateClaimId / updateEvidenceId reuse existing ids when present.
 * - Stable ids: `c_<uuid>` / `ev_<uuid>` / `r_<uuid>`.
 */

import { randomUUID } from "crypto";

import type {
  Claim,
  Evidence,
  EvidenceVerification,
  ExtractResponse,
  ModelExtract,
  Relation,
  SpeakerId,
} from "@/lib/extract/schema";

export function newClaimId(): string {
  return `c_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function newEvidenceId(): string {
  return `ev_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function newRelationId(): string {
  return `r_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export const PENDING_VERIFICATION: EvidenceVerification = {
  status: "pending",
  relevance: "pending",
  sources: [],
};

function looksLikeEvidenceId(ref: string): boolean {
  return ref.startsWith("ev_");
}

export type NormalizeModelExtractOpts = {
  existingClaims: Claim[];
  existingEvidence: Evidence[];
  existingRelations: Relation[];
  inferredSpeaker?: SpeakerId | null;
};

/**
 * Map model output (clientIds) → ExtractResponse deltas with stable ids.
 * Drops orphan evidence, self-relations, evidence endpoints, and duplicate relations.
 */
export function normalizeModelExtract(
  model: ModelExtract,
  opts: NormalizeModelExtractOpts,
): ExtractResponse {
  const now = Date.now();
  const notes: string[] = [];
  if (model.notes?.trim()) notes.push(model.notes.trim());

  const existingClaimById = new Map(
    opts.existingClaims.map((c) => [c.id, c] as const),
  );
  const existingEvidenceById = new Map(
    opts.existingEvidence.map((e) => [e.id, e] as const),
  );
  const knownClaimIds = new Set(existingClaimById.keys());

  const idByClient = new Map<string, string>();
  const claims: Claim[] = [];

  for (const c of model.claims) {
    const updateId = c.updateClaimId?.trim();
    const existing = updateId ? existingClaimById.get(updateId) : undefined;
    const id = existing ? existing.id : newClaimId();
    idByClient.set(c.clientId, id);
    knownClaimIds.add(id);

    // Targetless counterarguments are normalized after relations resolve.
    const nature = c.nature;
    const base: Claim = {
      id,
      text: c.text.trim(),
      speaker: c.speaker,
      nature,
      createdAt: existing?.createdAt ?? now,
      ...(existing ? { updatedAt: now } : {}),
      ...(c.sourceExcerpt !== undefined
        ? { sourceExcerpt: c.sourceExcerpt }
        : existing?.sourceExcerpt !== undefined
          ? { sourceExcerpt: existing.sourceExcerpt }
          : {}),
      ...(c.fallacies && c.fallacies.length > 0
        ? { fallacies: c.fallacies }
        : existing?.fallacies && existing.fallacies.length > 0
          ? { fallacies: existing.fallacies }
          : {}),
    };
    claims.push(base);
  }

  const resolveClaimRef = (ref: string): string | null => {
    if (idByClient.has(ref)) return idByClient.get(ref)!;
    if (ref.startsWith("c_") && knownClaimIds.has(ref)) return ref;
    // Existing graph ids that weren't in this delta still count
    if (ref.startsWith("c_") && existingClaimById.has(ref)) return ref;
    if (looksLikeEvidenceId(ref)) return null;
    return null;
  };

  const evidence: Evidence[] = [];
  for (const e of model.evidence) {
    const resolvedTargets = [
      ...new Set(
        e.targetClaimRefs
          .map((ref) => resolveClaimRef(ref))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (resolvedTargets.length === 0) {
      notes.push(
        `dropped orphan evidence clientId=${e.clientId} (no resolvable claim targets)`,
      );
      continue;
    }

    const updateId = e.updateEvidenceId?.trim();
    const existing = updateId ? existingEvidenceById.get(updateId) : undefined;
    const id = existing ? existing.id : newEvidenceId();

    evidence.push({
      id,
      text: e.text.trim(),
      speaker: e.speaker,
      supportsClaimIds: resolvedTargets,
      kind: e.kind,
      verification: existing?.verification
        ? { ...existing.verification, sources: [...existing.verification.sources] }
        : { ...PENDING_VERIFICATION, sources: [] },
      createdAt: existing?.createdAt ?? now,
      ...(existing ? { updatedAt: now } : {}),
      ...(e.sourceExcerpt !== undefined
        ? { sourceExcerpt: e.sourceExcerpt }
        : existing?.sourceExcerpt !== undefined
          ? { sourceExcerpt: existing.sourceExcerpt }
          : {}),
    });
  }

  const existingRelationKeys = new Set(
    opts.existingRelations.map((r) => `${r.from}|${r.to}|${r.type}`),
  );
  const seenRelationKeys = new Set<string>();
  const relations: Relation[] = [];
  const counterTargetsByFrom = new Map<string, string>();

  for (const r of model.relations) {
    if (looksLikeEvidenceId(r.from) || looksLikeEvidenceId(r.to)) {
      notes.push(`dropped relation with evidence endpoint ${r.from}->${r.to}`);
      continue;
    }
    const from = resolveClaimRef(r.from);
    const to = resolveClaimRef(r.to);
    if (!from || !to || from === to) continue;

    const key = `${from}|${to}|${r.type}`;
    if (seenRelationKeys.has(key) || existingRelationKeys.has(key)) continue;
    seenRelationKeys.add(key);

    relations.push({
      id: newRelationId(),
      from,
      to,
      type: r.type,
    });

    if (r.type === "counters" || r.type === "responds_to") {
      counterTargetsByFrom.set(from, to);
    }
  }

  // Normalize targetless counterarguments → argument + diagnostic note
  for (const claim of claims) {
    if (claim.nature !== "counterargument") continue;
    const hasTarget =
      counterTargetsByFrom.has(claim.id) ||
      relations.some(
        (r) =>
          r.from === claim.id &&
          (r.type === "counters" || r.type === "responds_to"),
      ) ||
      opts.existingRelations.some(
        (r) =>
          r.from === claim.id &&
          (r.type === "counters" || r.type === "responds_to"),
      );
    if (!hasTarget) {
      claim.nature = "argument";
      notes.push(
        `normalized targetless counterargument ${claim.id} → argument`,
      );
    }
  }

  // Remap UNKNOWN speakers using inferred speaker when available
  const inferred: SpeakerId =
    opts.inferredSpeaker && opts.inferredSpeaker !== "UNKNOWN"
      ? opts.inferredSpeaker
      : model.inferredSpeaker;

  const speakerConfidence =
    typeof model.speakerConfidence === "number"
      ? model.speakerConfidence
      : 0.5;

  for (const claim of claims) {
    if (claim.speaker === "UNKNOWN" && inferred !== "UNKNOWN") {
      claim.speaker = inferred;
    }
  }
  for (const item of evidence) {
    if (item.speaker === "UNKNOWN" && inferred !== "UNKNOWN") {
      item.speaker = inferred;
    }
  }

  return {
    claims,
    evidence,
    relations,
    inferredSpeaker: inferred,
    speakerConfidence,
    ...(notes.length > 0 ? { notes: notes.join("; ") } : {}),
  };
}
