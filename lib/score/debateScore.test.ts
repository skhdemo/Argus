import { describe, expect, it } from "vitest";

import {
  CLAIM_NATURE_BASE,
  DECISIVE_LEADER_SHARE,
  EVIDENCE_POSITIVE_CAP,
  EVIDENCE_UNIT_MULTIPLIER,
  RELEVANCE_WEIGHT,
  VERIFICATION_WEIGHT,
  accumulateEvidenceShares,
  computeDebateScore,
  evidenceUnit,
  normalizeSpeakerScores,
  scoreClaim,
} from "@/lib/score";
import type {
  Claim,
  Evidence,
  EvidenceVerification,
  Relation,
} from "@/lib/types/debate";

function verification(
  partial: Pick<EvidenceVerification, "status" | "relevance"> &
    Partial<EvidenceVerification>,
): EvidenceVerification {
  return { sources: [], ...partial };
}

function claim(
  partial: Pick<Claim, "id" | "speaker" | "nature"> & Partial<Claim>,
): Claim {
  return {
    text: partial.text ?? partial.id,
    createdAt: partial.createdAt ?? 1,
    ...partial,
  };
}

function evidenceItem(
  partial: Pick<Evidence, "id" | "supportsClaimIds"> &
    Partial<Evidence> & { verification?: EvidenceVerification },
): Evidence {
  return {
    text: partial.text ?? partial.id,
    speaker: partial.speaker ?? "A",
    kind: partial.kind ?? "factual_claim",
    createdAt: partial.createdAt ?? 1,
    verification:
      partial.verification ??
      verification({ status: "pending", relevance: "pending" }),
    ...partial,
  };
}

function relation(
  partial: Pick<Relation, "id" | "from" | "to" | "type">,
): Relation {
  return partial;
}

describe("evidenceUnit", () => {
  it("pending × pending × multiplier = 0.1875", () => {
    expect(
      evidenceUnit(
        evidenceItem({
          id: "ev",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "pending",
            relevance: "pending",
          }),
        }),
      ),
    ).toBeCloseTo(
      VERIFICATION_WEIGHT.pending *
        RELEVANCE_WEIGHT.pending *
        EVIDENCE_UNIT_MULTIPLIER,
      10,
    );
  });

  it("irrelevant corroborated contributes zero", () => {
    expect(
      evidenceUnit(
        evidenceItem({
          id: "ev",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "corroborated",
            relevance: "irrelevant",
          }),
        }),
      ),
    ).toBe(0);
  });
});

describe("normalizeSpeakerScores", () => {
  it("ties at 50-50 when both raw are zero", () => {
    const n = normalizeSpeakerScores(0, 0);
    expect(n.scoreA + n.scoreB).toBe(100);
    expect(n.ratioA).toBe(0.5);
    expect(n.leader).toBe("tied");
    expect(n.isDecisive).toBe(false);
  });

  it("floor-shifts negatives and marks decisive leads", () => {
    const n = normalizeSpeakerScores(-1.5, 4);
    expect(n.massA).toBe(0);
    expect(n.massB).toBe(5.5);
    expect(n.leader).toBe("B");
    expect(n.isDecisive).toBe(true);
    expect(n.leaderShare).toBeGreaterThanOrEqual(DECISIVE_LEADER_SHARE);
    expect(n.scoreA + n.scoreB).toBe(100);
  });
});

describe("computeDebateScore — Messi worked example", () => {
  it("one claim + one pending evidence → documented arithmetic", () => {
    const claims = [
      claim({
        id: "c_messi",
        speaker: "A",
        nature: "argument",
        text: "Messi is better",
      }),
    ];
    const evidence = [
      evidenceItem({
        id: "ev_messi",
        speaker: "A",
        supportsClaimIds: ["c_messi"],
        kind: "factual_claim",
        text: "He won a World Cup and two Copa Américas",
        verification: verification({
          status: "pending",
          relevance: "pending",
        }),
      }),
    ];

    const result = computeDebateScore(claims, evidence, []);

    // Evidence is never a second claim
    expect(result.claimScores).toHaveLength(1);
    expect(result.evidenceScores).toHaveLength(1);

    // unit = 0.25 × 0.50 × 1.5 = 0.1875
    // S = 1 + 0.1875 = 1.1875
    expect(result.evidenceScores[0].unitTotal).toBeCloseTo(0.1875, 10);
    expect(result.claimScores[0].base).toBe(CLAIM_NATURE_BASE.argument);
    expect(result.claimScores[0].evidenceContribution).toBeCloseTo(0.1875, 10);
    expect(result.claimScores[0].unsupportedPenalty).toBe(0);
    expect(result.rawA).toBeCloseTo(1.1875, 10);
    expect(result.rawB).toBe(0);
    expect(result.scoreA).toBe(100);
    expect(result.scoreB).toBe(0);
    expect(result.scoreA + result.scoreB).toBe(100);
    expect(result.leader).toBe("A");
  });

  it("corroborated strong Messi evidence raises contribution to 1.5", () => {
    const result = computeDebateScore(
      [
        claim({
          id: "c_messi",
          speaker: "A",
          nature: "argument",
          text: "Messi is better",
        }),
      ],
      [
        evidenceItem({
          id: "ev_messi",
          supportsClaimIds: ["c_messi"],
          verification: verification({
            status: "corroborated",
            relevance: "strong",
          }),
        }),
      ],
      [],
    );
    expect(result.claimScores[0].evidenceContribution).toBeCloseTo(1.5, 10);
    expect(result.rawA).toBeCloseTo(2.5, 10);
  });
});

describe("computeDebateScore — required invariants", () => {
  it("empty graph gives 50/50", () => {
    const result = computeDebateScore([], [], []);
    expect(result.leader).toBe("tied");
    expect(result.scoreA).toBe(50);
    expect(result.scoreB).toBe(50);
    expect(result.scoreA + result.scoreB).toBe(100);
  });

  it("UNKNOWN speakers contribute zero", () => {
    const result = computeDebateScore(
      [
        claim({ id: "u", speaker: "UNKNOWN", nature: "argument" }),
        claim({ id: "a", speaker: "A", nature: "argument" }),
      ],
      [
        evidenceItem({
          id: "ev",
          speaker: "UNKNOWN",
          supportsClaimIds: ["u"],
          verification: verification({
            status: "corroborated",
            relevance: "strong",
          }),
        }),
      ],
      [
        relation({
          id: "r",
          from: "u",
          to: "a",
          type: "counters",
        }),
      ],
    );
    // Only A's bare argument: 1 - 1.5 = -0.5
    expect(result.rawA).toBeCloseTo(-0.5, 10);
    expect(result.rawB).toBe(0);
  });

  it("A/B swap mirrors score", () => {
    const claims = [
      claim({ id: "c1", speaker: "A", nature: "argument" }),
      claim({ id: "c2", speaker: "B", nature: "counterargument" }),
    ];
    const evidence = [
      evidenceItem({
        id: "ev",
        supportsClaimIds: ["c1"],
        verification: verification({
          status: "corroborated",
          relevance: "strong",
        }),
      }),
    ];
    const relations = [
      relation({ id: "r", from: "c2", to: "c1", type: "counters" }),
    ];
    const original = computeDebateScore(claims, evidence, relations);
    const swappedClaims = claims.map((c) => ({
      ...c,
      speaker:
        c.speaker === "A"
          ? ("B" as const)
          : c.speaker === "B"
            ? ("A" as const)
            : c.speaker,
    }));
    const swapped = computeDebateScore(swappedClaims, evidence, relations);
    expect(swapped.rawA).toBeCloseTo(original.rawB, 10);
    expect(swapped.rawB).toBeCloseTo(original.rawA, 10);
    expect(swapped.ratioA).toBeCloseTo(original.ratioB, 10);
    expect(swapped.scoreA + swapped.scoreB).toBe(100);
  });

  it("unsupported penalty is applied once", () => {
    const result = computeDebateScore(
      [claim({ id: "c1", speaker: "A", nature: "argument" })],
      [],
      [],
    );
    expect(result.claimScores[0].unsupportedPenalty).toBe(-1.5);
    expect(result.claimScores[0].total).toBeCloseTo(1 - 1.5, 10);
    expect(result.rawA).toBeCloseTo(-0.5, 10);
  });

  it("Evidence is never counted as a Claim", () => {
    const result = computeDebateScore(
      [claim({ id: "c1", speaker: "A", nature: "argument" })],
      [
        evidenceItem({
          id: "ev1",
          supportsClaimIds: ["c1"],
          text: "trophy justification",
        }),
      ],
      [],
    );
    expect(result.claimScores).toHaveLength(1);
    expect(result.claimScores[0].base).toBe(1);
    // No second +1 claim base for the evidence text
    expect(result.rawA).toBeLessThan(3);
  });

  it("one Evidence supporting multiple Claims does not multiply total contribution", () => {
    const { shareByClaim, evidenceScores } = accumulateEvidenceShares([
      evidenceItem({
        id: "ev",
        supportsClaimIds: ["c1", "c2"],
        verification: verification({
          status: "corroborated",
          relevance: "strong",
        }),
      }),
    ]);
    expect(evidenceScores[0].unitTotal).toBeCloseTo(1.5, 10);
    expect(evidenceScores[0].perTargetShare).toBeCloseTo(0.75, 10);
    expect(shareByClaim.get("c1")).toBeCloseTo(0.75, 10);
    expect(shareByClaim.get("c2")).toBeCloseTo(0.75, 10);
    // Total across claims equals one unit, not 2×
    expect(
      (shareByClaim.get("c1") ?? 0) + (shareByClaim.get("c2") ?? 0),
    ).toBeCloseTo(1.5, 10);
  });

  it("contested Evidence reduces support", () => {
    const withPending = computeDebateScore(
      [claim({ id: "c1", speaker: "A", nature: "argument" })],
      [
        evidenceItem({
          id: "ev",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "pending",
            relevance: "pending",
          }),
        }),
      ],
      [],
    );
    const withContested = computeDebateScore(
      [claim({ id: "c1", speaker: "A", nature: "argument" })],
      [
        evidenceItem({
          id: "ev",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "contested",
            relevance: "strong",
          }),
        }),
      ],
      [],
    );
    // contested unit = -0.5 × 1.0 × 1.5 = -0.75
    expect(withContested.claimScores[0].evidenceContribution).toBeCloseTo(
      -0.75,
      10,
    );
    expect(withContested.rawA).toBeLessThan(withPending.rawA);
  });

  it("pending Evidence is provisional (positive but small)", () => {
    const result = computeDebateScore(
      [claim({ id: "c1", speaker: "A", nature: "argument" })],
      [
        evidenceItem({
          id: "ev",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "pending",
            relevance: "pending",
          }),
        }),
      ],
      [],
    );
    expect(result.claimScores[0].evidenceContribution).toBeGreaterThan(0);
    expect(result.claimScores[0].evidenceContribution).toBeLessThan(0.5);
    expect(result.claimScores[0].unsupportedPenalty).toBe(0);
  });

  it("Evidence caps prevent spam", () => {
    const spam = Array.from({ length: 10 }, (_, i) =>
      evidenceItem({
        id: `ev${i}`,
        supportsClaimIds: ["c1"],
        verification: verification({
          status: "corroborated",
          relevance: "strong",
        }),
      }),
    );
    const result = computeDebateScore(
      [claim({ id: "c1", speaker: "A", nature: "argument" })],
      spam,
      [],
    );
    expect(result.claimScores[0].evidenceContribution).toBe(
      EVIDENCE_POSITIVE_CAP,
    );
  });

  it("fallacy caps work", () => {
    const result = scoreClaim(
      claim({
        id: "c1",
        speaker: "A",
        nature: "argument",
        fallacies: [
          "strawman",
          "ad_hominem",
          "circular_reasoning",
          "false_dilemma",
        ],
      }),
      [],
      new Map(),
    );
    expect(result.fallacyPenalty).toBe(-3);
  });

  it("counterargument attack is not double-counted", () => {
    // Nature base +1; attack credit only from relation (+2), not a second nature bonus
    const result = computeDebateScore(
      [
        claim({ id: "cA", speaker: "A", nature: "argument" }),
        claim({ id: "cB", speaker: "B", nature: "counterargument" }),
      ],
      [],
      [relation({ id: "r", from: "cB", to: "cA", type: "counters" })],
    );
    const bClaim = result.claimScores.find((c) => c.claimId === "cB")!;
    expect(bClaim.base).toBe(1);
    expect(result.relationScores).toHaveLength(1);
    expect(result.relationScores[0].credit).toBe(2);
    // B: claim 1-1.5 (unsupported) + relation 2+1 rebuttal = 2.5
    // A: claim 1-1.5 = -0.5, undercut -1 → -1.5
    expect(result.rawB).toBeCloseTo(-0.5 + 2 + 1, 10);
    expect(result.rawA).toBeCloseTo(-0.5 - 1, 10);
    expect(result.undercutA).toBe(1);
  });

  it("scoreA + scoreB is always 100", () => {
    const cases: Array<{
      claims: Claim[];
      evidence: Evidence[];
      relations: Relation[];
    }> = [
      { claims: [], evidence: [], relations: [] },
      {
        claims: [claim({ id: "c", speaker: "A", nature: "argument" })],
        evidence: [],
        relations: [],
      },
      {
        claims: [
          claim({ id: "c1", speaker: "A", nature: "argument" }),
          claim({ id: "c2", speaker: "B", nature: "counterargument" }),
        ],
        evidence: [
          evidenceItem({
            id: "ev",
            supportsClaimIds: ["c1"],
            verification: verification({
              status: "corroborated",
              relevance: "moderate",
            }),
          }),
        ],
        relations: [
          relation({ id: "r", from: "c2", to: "c1", type: "responds_to" }),
        ],
      },
    ];
    for (const c of cases) {
      const result = computeDebateScore(c.claims, c.evidence, c.relations);
      expect(result.scoreA + result.scoreB).toBe(100);
    }
  });
});
