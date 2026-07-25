import { describe, expect, it } from "vitest";

import {
  CLAIM_BASE,
  DECISIVE_LEADER_SHARE,
  computeDebateScore,
  normalizeSpeakerScores,
  scoreClaim,
} from "@/lib/score";
import type { Claim, Edge } from "@/lib/types/debate";

function claim(
  partial: Pick<Claim, "id" | "speaker" | "type"> & Partial<Claim>,
): Claim {
  return {
    text: partial.text ?? partial.id,
    createdAt: partial.createdAt ?? 1,
    ...partial,
  };
}

function edge(
  partial: Pick<Edge, "id" | "from" | "to" | "type">,
): Edge {
  return partial;
}

describe("scoreClaim", () => {
  it("uses CLAIM_BASE for each type", () => {
    for (const type of Object.keys(CLAIM_BASE) as (keyof typeof CLAIM_BASE)[]) {
      const result = scoreClaim(
        claim({ id: "c", speaker: "A", type }),
        true,
      );
      expect(result.base).toBe(CLAIM_BASE[type]);
    }
  });

  it("applies unsupported + needs_evidence + fallacy penalties", () => {
    const result = scoreClaim(
      claim({
        id: "c",
        speaker: "A",
        type: "needs_evidence",
        unsupported: true,
        fallacies: ["strawman", "ad_hominem"],
      }),
      false,
    );
    // base -1; unsupported -1.5; no-support -1; 2 fallacies -2 → total -5.5
    expect(result.penalties).toBe(-1.5 - 1 - 2);
    expect(result.total).toBe(-1 + result.penalties);
  });

  it("caps fallacy penalty at 3", () => {
    const result = scoreClaim(
      claim({
        id: "c",
        speaker: "A",
        type: "assumption",
        fallacies: [
          "strawman",
          "ad_hominem",
          "circular_reasoning",
          "false_dilemma",
        ],
      }),
      true,
    );
    expect(result.penalties).toBe(-3);
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
    const n = normalizeSpeakerScores(-5.5, 5.5);
    expect(n.massA).toBe(0);
    expect(n.massB).toBe(11);
    expect(n.ratioB).toBe(1);
    expect(n.leader).toBe("B");
    expect(n.isDecisive).toBe(true);
    expect(n.leaderShare).toBeGreaterThanOrEqual(DECISIVE_LEADER_SHARE);
    expect(n.scoreA + n.scoreB).toBe(100);
  });
});

describe("computeDebateScore — worked proofs from DEBATE_SCORING.md", () => {
  it("micro debate: B slightly ahead", () => {
    const claims: Claim[] = [
      claim({
        id: "c1",
        speaker: "A",
        type: "needs_evidence",
        text: "Remote should be default",
      }),
      claim({
        id: "c2",
        speaker: "A",
        type: "supported",
        text: "Study shows +4% productivity",
      }),
      claim({
        id: "c3",
        speaker: "B",
        type: "counterargument",
        text: "Office better for collab",
      }),
    ];
    const edges: Edge[] = [
      edge({ id: "e1", from: "c2", to: "c1", type: "supports" }),
      edge({ id: "e2", from: "c3", to: "c1", type: "contradicts" }),
    ];

    const result = computeDebateScore(claims, edges);

    // Raw_A = -1 + 3 + 2 = 4; Raw_B = 2 + 3.5 = 5.5 (rebuttal on needs_evidence)
    expect(result.rawA).toBe(4);
    expect(result.rawB).toBe(5.5);
    expect(result.undercutA).toBe(0);
    expect(result.leader).toBe("B");
    expect(result.isDecisive).toBe(false);
    expect(result.scoreA).toBe(42);
    expect(result.scoreB).toBe(58);
    expect(result.scoreA + result.scoreB).toBe(100);
  });

  it("unsupported fallacy undercut: B decisive", () => {
    const claims: Claim[] = [
      claim({
        id: "cA",
        speaker: "A",
        type: "needs_evidence",
        unsupported: true,
        fallacies: ["strawman"],
      }),
      claim({
        id: "cB",
        speaker: "B",
        type: "counterargument",
      }),
    ];
    const edges: Edge[] = [
      edge({ id: "e", from: "cB", to: "cA", type: "contradicts" }),
    ];

    const result = computeDebateScore(claims, edges);

    // A: -1 -1.5 -1 -1 (claim) -1 undercut = -5.5
    // B: +2 + 3.5 edge = 5.5
    expect(result.rawA).toBe(-5.5);
    expect(result.rawB).toBe(5.5);
    expect(result.undercutA).toBe(1);
    expect(result.leader).toBe("B");
    expect(result.ratioB).toBe(1);
    expect(result.isDecisive).toBe(true);
    expect(result.scoreA + result.scoreB).toBe(100);
  });
});

describe("computeDebateScore — invariants", () => {
  it("ignores UNKNOWN speakers", () => {
    const claims: Claim[] = [
      claim({ id: "u", speaker: "UNKNOWN", type: "supported" }),
      claim({ id: "a", speaker: "A", type: "assumption" }),
    ];
    const edges: Edge[] = [
      edge({ id: "e", from: "u", to: "a", type: "supports" }),
    ];
    const result = computeDebateScore(claims, edges);
    // Only A's assumption +0.5; UNKNOWN claim/edge ignored
    expect(result.rawA).toBe(0.5);
    expect(result.rawB).toBe(0);
  });

  it("swapping A↔B speakers mirrors raw scores", () => {
    const claims: Claim[] = [
      claim({ id: "c1", speaker: "A", type: "supported" }),
      claim({ id: "c2", speaker: "B", type: "needs_evidence" }),
    ];
    const edges: Edge[] = [
      edge({ id: "e", from: "c1", to: "c2", type: "contradicts" }),
    ];
    const original = computeDebateScore(claims, edges);

    const swappedClaims = claims.map((c) => ({
      ...c,
      speaker:
        c.speaker === "A" ? ("B" as const) : c.speaker === "B" ? ("A" as const) : c.speaker,
    }));
    const swapped = computeDebateScore(swappedClaims, edges);

    expect(swapped.rawA).toBe(original.rawB);
    expect(swapped.rawB).toBe(original.rawA);
    expect(swapped.ratioA).toBeCloseTo(original.ratioB, 10);
  });

  it("adding a supports edge from A does not decrease rawA", () => {
    const claims: Claim[] = [
      claim({ id: "c1", speaker: "A", type: "needs_evidence" }),
      claim({ id: "c2", speaker: "A", type: "supported" }),
    ];
    const before = computeDebateScore(claims, []);
    const after = computeDebateScore(claims, [
      edge({ id: "e", from: "c2", to: "c1", type: "supports" }),
    ]);
    expect(after.rawA).toBeGreaterThanOrEqual(before.rawA);
  });

  it("empty graph is a tie", () => {
    const result = computeDebateScore([], []);
    expect(result.leader).toBe("tied");
    expect(result.scoreA).toBe(50);
    expect(result.scoreB).toBe(50);
  });
});
