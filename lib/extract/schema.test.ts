import { describe, expect, it } from "vitest";

import {
  claimSchema,
  evidenceSchema,
  extractRequestSchema,
  extractResponseSchema,
  modelClaimSchema,
  modelEvidenceSchema,
  modelExtractSchema,
  modelRelationSchema,
  relationSchema,
} from "@/lib/extract/schema";

const pendingVerification = {
  status: "pending" as const,
  relevance: "pending" as const,
  sources: [],
};

describe("public claim schema", () => {
  it.each([
    {
      name: "accepts argument claim",
      value: {
        id: "c_abc",
        text: "Remote work raises productivity.",
        speaker: "A",
        nature: "argument",
        createdAt: 1,
      },
      ok: true,
    },
    {
      name: "rejects old type field",
      value: {
        id: "c_abc",
        text: "Remote work raises productivity.",
        speaker: "A",
        type: "needs_evidence",
        createdAt: 1,
      },
      ok: false,
    },
    {
      name: "rejects missing nature",
      value: {
        id: "c_abc",
        text: "x",
        speaker: "A",
        createdAt: 1,
      },
      ok: false,
    },
  ])("$name", ({ value, ok }) => {
    expect(claimSchema.safeParse(value).success).toBe(ok);
  });
});

describe("public evidence schema", () => {
  it.each([
    {
      name: "accepts pending evidence",
      value: {
        id: "ev_1",
        text: "A 2023 meta-analysis found a 4% gain.",
        speaker: "A",
        supportsClaimIds: ["c_abc"],
        kind: "statistic",
        verification: pendingVerification,
        createdAt: 1,
      },
      ok: true,
    },
    {
      name: "rejects empty supportsClaimIds (orphan)",
      value: {
        id: "ev_1",
        text: "orphan",
        speaker: "A",
        supportsClaimIds: [],
        kind: "reasoning",
        verification: pendingVerification,
        createdAt: 1,
      },
      ok: false,
    },
  ])("$name", ({ value, ok }) => {
    expect(evidenceSchema.safeParse(value).success).toBe(ok);
  });
});

describe("public relation schema", () => {
  it.each([
    {
      name: "accepts counters",
      value: { id: "r_1", from: "c_a", to: "c_b", type: "counters" },
      ok: true,
    },
    {
      name: "rejects old supports type",
      value: { id: "r_1", from: "c_a", to: "c_b", type: "supports" },
      ok: false,
    },
    {
      name: "rejects contradicts alias",
      value: { id: "r_1", from: "c_a", to: "c_b", type: "contradicts" },
      ok: false,
    },
  ])("$name", ({ value, ok }) => {
    expect(relationSchema.safeParse(value).success).toBe(ok);
  });
});

describe("extract request schema", () => {
  it("accepts existing claims/evidence/relations", () => {
    const parsed = extractRequestSchema.safeParse({
      text: "hello",
      existingClaims: [
        {
          id: "c_1",
          text: "Claim",
          speaker: "A",
          nature: "argument",
          createdAt: 1,
        },
      ],
      existingEvidence: [
        {
          id: "ev_1",
          text: "Because X",
          speaker: "A",
          supportsClaimIds: ["c_1"],
          kind: "reasoning",
          verification: pendingVerification,
          createdAt: 1,
        },
      ],
      existingRelations: [],
      pauseMs: 1200,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects legacy existingEdges-only payloads without text", () => {
    expect(extractRequestSchema.safeParse({ existingEdges: [] }).success).toBe(
      false,
    );
  });
});

describe("model extract schema", () => {
  it.each([
    {
      name: "accepts v2 model claim",
      parse: () =>
        modelClaimSchema.safeParse({
          clientId: "n1",
          text: "Messi is the better player",
          speaker: "A",
          nature: "argument",
        }),
      ok: true,
    },
    {
      name: "rejects old claim.type",
      parse: () =>
        modelClaimSchema.safeParse({
          clientId: "n1",
          text: "x",
          speaker: "A",
          type: "needs_evidence",
        }),
      ok: false,
    },
    {
      name: "rejects unsupported boolean on model claim",
      parse: () =>
        modelClaimSchema.safeParse({
          clientId: "n1",
          text: "x",
          speaker: "A",
          nature: "argument",
          unsupported: true,
        }),
      ok: false,
    },
    {
      name: "accepts evidence with targets",
      parse: () =>
        modelEvidenceSchema.safeParse({
          clientId: "e1",
          text: "He won a World Cup",
          speaker: "A",
          kind: "factual_claim",
          targetClaimRefs: ["n1"],
        }),
      ok: true,
    },
    {
      name: "rejects orphan evidence (empty targets)",
      parse: () =>
        modelEvidenceSchema.safeParse({
          clientId: "e1",
          text: "orphan",
          speaker: "A",
          kind: "reasoning",
          targetClaimRefs: [],
        }),
      ok: false,
    },
    {
      name: "rejects supports relation",
      parse: () =>
        modelRelationSchema.safeParse({
          from: "n1",
          to: "n2",
          type: "supports",
        }),
      ok: false,
    },
    {
      name: "accepts counters relation",
      parse: () =>
        modelRelationSchema.safeParse({
          from: "n2",
          to: "n1",
          type: "counters",
        }),
      ok: true,
    },
  ])("$name", ({ parse, ok }) => {
    expect(parse().success).toBe(ok);
  });

  it("parses full model extract defaults", () => {
    const parsed = modelExtractSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.claims).toEqual([]);
    expect(parsed.data.evidence).toEqual([]);
    expect(parsed.data.relations).toEqual([]);
    expect(parsed.data.inferredSpeaker).toBe("UNKNOWN");
  });
});

describe("extract response schema", () => {
  it("accepts deltas shaped like ExtractResponse", () => {
    const parsed = extractResponseSchema.safeParse({
      claims: [
        {
          id: "c_1",
          text: "Messi is better",
          speaker: "A",
          nature: "argument",
          createdAt: 1,
        },
      ],
      evidence: [
        {
          id: "ev_1",
          text: "Won World Cup and two Copa Américas",
          speaker: "A",
          supportsClaimIds: ["c_1"],
          kind: "factual_claim",
          verification: pendingVerification,
          createdAt: 1,
        },
      ],
      relations: [],
      inferredSpeaker: "A",
      speakerConfidence: 0.7,
    });
    expect(parsed.success).toBe(true);
  });
});
