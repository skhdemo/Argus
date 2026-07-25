import { describe, expect, it } from "vitest";

import {
  buildFallbackNarrative,
  computeSummaryStats,
  findMostContestedClaimId,
  resolveMostContestedClaimId,
} from "@/lib/summary/stats";
import type {
  Claim,
  Evidence,
  EvidenceVerification,
  Relation,
} from "@/lib/types/debate";

function claim(
  partial: Pick<Claim, "id" | "speaker" | "nature"> & Partial<Claim>,
): Claim {
  return {
    text: partial.text ?? partial.id,
    createdAt: 1,
    ...partial,
  };
}

function verification(
  status: EvidenceVerification["status"],
  relevance: EvidenceVerification["relevance"] = "pending",
): EvidenceVerification {
  return { status, relevance, sources: [] };
}

function evidence(
  partial: Pick<Evidence, "id" | "supportsClaimIds"> & Partial<Evidence>,
): Evidence {
  return {
    text: partial.text ?? partial.id,
    speaker: "A",
    kind: "factual_claim",
    createdAt: 1,
    verification: verification("pending"),
    ...partial,
  };
}

function relation(
  partial: Pick<Relation, "id" | "from" | "to" | "type">,
): Relation {
  return partial;
}

describe("computeSummaryStats", () => {
  it("uses evidence.length and deriveSpeakerSupport for unsupported", () => {
    const claims = [
      claim({ id: "c1", speaker: "A", nature: "argument" }),
      claim({ id: "c2", speaker: "B", nature: "counterargument" }),
    ];
    const evidenceList = [
      evidence({
        id: "ev1",
        supportsClaimIds: ["c1"],
        verification: verification("corroborated", "strong"),
      }),
    ];
    const stats = computeSummaryStats(claims, evidenceList, []);
    expect(stats.claimCount).toBe(2);
    expect(stats.evidenceCount).toBe(1);
    expect(stats.unsupportedCount).toBe(1); // c2 only
    expect(stats.corroboratedEvidenceCount).toBe(1);
    expect(stats.pendingEvidenceCount).toBe(0);
  });

  it("tallies verification statuses including inconclusive and not_verifiable", () => {
    const claims = [claim({ id: "c1", speaker: "A", nature: "argument" })];
    const evidenceList = [
      evidence({
        id: "ev1",
        supportsClaimIds: ["c1"],
        verification: verification("pending"),
      }),
      evidence({
        id: "ev2",
        supportsClaimIds: ["c1"],
        verification: verification("contested", "moderate"),
      }),
      evidence({
        id: "ev3",
        supportsClaimIds: ["c1"],
        verification: verification("inconclusive"),
      }),
      evidence({
        id: "ev4",
        supportsClaimIds: ["c1"],
        kind: "anecdote",
        verification: verification("not_verifiable", "weak"),
      }),
      evidence({
        id: "ev5",
        supportsClaimIds: ["c1"],
        verification: verification("error"),
      }),
    ];
    const stats = computeSummaryStats(claims, evidenceList, []);
    expect(stats.evidenceCount).toBe(5);
    expect(stats.pendingEvidenceCount).toBe(2); // pending + error
    expect(stats.contestedEvidenceCount).toBe(1);
    expect(stats.inconclusiveEvidenceCount).toBe(1);
    expect(stats.notVerifiableEvidenceCount).toBe(1);
    expect(stats.unsupportedCount).toBe(0);
  });

  it("mostContestedClaimId comes from counters/responds_to, not supports edges", () => {
    const claims = [
      claim({ id: "c1", speaker: "A", nature: "argument" }),
      claim({ id: "c2", speaker: "B", nature: "counterargument" }),
      claim({ id: "c3", speaker: "A", nature: "argument" }),
    ];
    const relations = [
      relation({ id: "r1", from: "c2", to: "c1", type: "counters" }),
      relation({ id: "r2", from: "c3", to: "c1", type: "responds_to" }),
      relation({ id: "r3", from: "c2", to: "c3", type: "counters" }),
    ];
    // Targets: c1×2, c3×1 → c1 most contested
    expect(findMostContestedClaimId(claims, relations)).toBe("c1");
    const stats = computeSummaryStats(claims, [], relations);
    expect(stats.mostContestedClaimId).toBe("c1");
  });

  it("does not count evidence via legacy supports edges", () => {
    const stats = computeSummaryStats(
      [claim({ id: "c1", speaker: "A", nature: "argument" })],
      [],
      [],
    );
    expect(stats.evidenceCount).toBe(0);
    expect(stats.unsupportedCount).toBe(1);
  });
});

describe("resolveMostContestedClaimId / fallback narrative", () => {
  it("rejects unknown model ids", () => {
    const claims = [claim({ id: "c1", speaker: "A", nature: "argument" })];
    expect(resolveMostContestedClaimId("c_missing", claims, "c1")).toBe("c1");
    expect(resolveMostContestedClaimId("c1", claims, null)).toBe("c1");
  });

  it("buildFallbackNarrative avoids true/false language", () => {
    const narrative = buildFallbackNarrative({
      claimCount: 2,
      evidenceCount: 1,
      unsupportedCount: 1,
      pendingEvidenceCount: 1,
      corroboratedEvidenceCount: 0,
      contestedEvidenceCount: 0,
      inconclusiveEvidenceCount: 0,
      notVerifiableEvidenceCount: 0,
      mostContestedClaimId: "c1",
    });
    expect(narrative).toMatch(/pending confirmation/i);
    expect(narrative).not.toMatch(/\btrue\b|\bfalse\b/i);
  });
});
