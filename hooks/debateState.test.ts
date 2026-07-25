import { describe, expect, it } from "vitest";

import {
  mergeExtractDelta,
  type DebateGraphState,
} from "@/hooks/debateState";
import type {
  Claim,
  Evidence,
  ExtractResponse,
  Relation,
} from "@/lib/types/debate";

const claim = (id: string, text = id): Claim => ({
  id,
  text,
  speaker: "A",
  nature: "argument",
  createdAt: 1,
});

const evidence = (id: string, supportsClaimIds: string[]): Evidence => ({
  id,
  text: id,
  speaker: "A",
  supportsClaimIds,
  kind: "factual_claim",
  verification: {
    status: "pending",
    relevance: "pending",
    sources: [],
  },
  createdAt: 1,
});

const relation = (id: string, from: string, to: string): Relation => ({
  id,
  from,
  to,
  type: "counters",
});

function delta(
  claims: Claim[],
  items: Evidence[],
  relations: Relation[],
): ExtractResponse {
  return {
    claims,
    evidence: items,
    relations,
    inferredSpeaker: "A",
    speakerConfidence: 0.8,
  };
}

describe("mergeExtractDelta", () => {
  it("merges all entities by id", () => {
    const current: DebateGraphState = {
      claims: [claim("c_1", "old")],
      evidence: [evidence("ev_1", ["c_1"])],
      relations: [],
    };

    const result = mergeExtractDelta(
      current,
      delta(
        [claim("c_1", "updated"), claim("c_2")],
        [{ ...evidence("ev_1", ["c_1"]), text: "updated evidence" }],
        [relation("r_1", "c_2", "c_1")],
      ),
    );

    expect(result.claims.map((item) => item.text)).toEqual(["updated", "c_2"]);
    expect(result.evidence[0]?.text).toBe("updated evidence");
    expect(result.relations).toEqual([relation("r_1", "c_2", "c_1")]);
  });

  it("sanitizes evidence targets against current and incoming claims", () => {
    const result = mergeExtractDelta(
      { claims: [claim("c_1")], evidence: [], relations: [] },
      delta(
        [claim("c_2")],
        [
          evidence("ev_valid", ["c_1", "missing", "c_2", "c_2"]),
          evidence("ev_orphan", ["missing"]),
        ],
        [],
      ),
    );

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.supportsClaimIds).toEqual(["c_1", "c_2"]);
  });

  it("drops self, orphan, and evidence-endpoint relations", () => {
    const result = mergeExtractDelta(
      { claims: [claim("c_1")], evidence: [], relations: [] },
      delta(
        [claim("c_2")],
        [],
        [
          relation("r_valid", "c_2", "c_1"),
          relation("r_self", "c_1", "c_1"),
          relation("r_orphan", "c_1", "c_missing"),
          relation("r_evidence", "ev_bad", "c_1"),
        ],
      ),
    );

    expect(result.relations).toEqual([relation("r_valid", "c_2", "c_1")]);
  });

  it("does not replace valid stored entities with invalid deltas", () => {
    const storedEvidence = evidence("ev_1", ["c_1"]);
    const storedRelation = relation("r_1", "c_1", "c_2");
    const result = mergeExtractDelta(
      {
        claims: [claim("c_1"), claim("c_2")],
        evidence: [storedEvidence],
        relations: [storedRelation],
      },
      delta(
        [],
        [{ ...storedEvidence, supportsClaimIds: ["missing"] }],
        [{ ...storedRelation, from: "ev_1" }],
      ),
    );

    expect(result.evidence).toEqual([storedEvidence]);
    expect(result.relations).toEqual([storedRelation]);
  });
});
