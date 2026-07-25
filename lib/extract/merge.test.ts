import { describe, expect, it } from "vitest";

import { normalizeModelExtract } from "@/lib/extract/merge";
import type { ModelExtract } from "@/lib/extract/schema";
import type { Claim, Evidence, Relation } from "@/lib/extract/schema";

const pending = {
  status: "pending" as const,
  relevance: "pending" as const,
  sources: [] as [],
};

function baseOpts(overrides?: {
  existingClaims?: Claim[];
  existingEvidence?: Evidence[];
  existingRelations?: Relation[];
  inferredSpeaker?: "A" | "B" | "UNKNOWN" | null;
}) {
  return {
    existingClaims: overrides?.existingClaims ?? [],
    existingEvidence: overrides?.existingEvidence ?? [],
    existingRelations: overrides?.existingRelations ?? [],
    inferredSpeaker: overrides?.inferredSpeaker ?? null,
  };
}

describe("normalizeModelExtract", () => {
  it("Messi regression: one claim, one evidence, zero evidence-as-claim", () => {
    const model: ModelExtract = {
      claims: [
        {
          clientId: "n1",
          text: "Messi is better",
          speaker: "A",
          nature: "argument",
        },
      ],
      evidence: [
        {
          clientId: "e1",
          text: "He won a World Cup and two Copa Américas",
          speaker: "A",
          kind: "factual_claim",
          targetClaimRefs: ["n1"],
        },
      ],
      relations: [],
      inferredSpeaker: "A",
      speakerConfidence: 0.8,
    };

    const result = normalizeModelExtract(model, baseOpts());

    expect(result.claims).toHaveLength(1);
    expect(result.evidence).toHaveLength(1);
    expect(result.relations).toHaveLength(0);
    expect(result.claims[0].id).toMatch(/^c_/);
    expect(result.evidence[0].id).toMatch(/^ev_/);
    expect(result.evidence[0].supportsClaimIds).toEqual([result.claims[0].id]);
    // No second claim for the World Cup justification
    expect(result.claims.every((c) => !/World Cup/i.test(c.text))).toBe(true);
  });

  it.each([
    {
      name: "assigns c_/ev_/r_ prefixes",
      run: () => {
        const result = normalizeModelExtract(
          {
            claims: [
              {
                clientId: "n1",
                text: "A",
                speaker: "A",
                nature: "argument",
              },
              {
                clientId: "n2",
                text: "Not A",
                speaker: "B",
                nature: "counterargument",
              },
            ],
            evidence: [
              {
                clientId: "e1",
                text: "stats",
                speaker: "A",
                kind: "statistic",
                targetClaimRefs: ["n1"],
              },
            ],
            relations: [{ from: "n2", to: "n1", type: "counters" }],
            inferredSpeaker: "B",
            speakerConfidence: 0.6,
          },
          baseOpts(),
        );
        expect(result.claims.every((c) => c.id.startsWith("c_"))).toBe(true);
        expect(result.evidence.every((e) => e.id.startsWith("ev_"))).toBe(true);
        expect(result.relations.every((r) => r.id.startsWith("r_"))).toBe(true);
      },
    },
    {
      name: "updateClaimId reuses id and preserves createdAt",
      run: () => {
        const existing: Claim = {
          id: "c_existing01",
          text: "Old text",
          speaker: "A",
          nature: "argument",
          createdAt: 1000,
        };
        const result = normalizeModelExtract(
          {
            claims: [
              {
                clientId: "n1",
                updateClaimId: "c_existing01",
                text: "Clarified text",
                speaker: "A",
                nature: "argument",
              },
            ],
            evidence: [],
            relations: [],
            inferredSpeaker: "A",
            speakerConfidence: 0.5,
          },
          baseOpts({ existingClaims: [existing] }),
        );
        expect(result.claims).toHaveLength(1);
        expect(result.claims[0].id).toBe("c_existing01");
        expect(result.claims[0].text).toBe("Clarified text");
        expect(result.claims[0].createdAt).toBe(1000);
        expect(result.claims[0].updatedAt).toBeTypeOf("number");
      },
    },
    {
      name: "updateEvidenceId reuses id and preserves verification",
      run: () => {
        const existing: Evidence = {
          id: "ev_existing01",
          text: "Old evidence",
          speaker: "A",
          supportsClaimIds: ["c_existing01"],
          kind: "citation",
          verification: {
            status: "corroborated",
            relevance: "strong",
            sources: [{ uri: "https://example.com" }],
          },
          createdAt: 2000,
        };
        const result = normalizeModelExtract(
          {
            claims: [],
            evidence: [
              {
                clientId: "e1",
                updateEvidenceId: "ev_existing01",
                text: "Updated evidence",
                speaker: "A",
                kind: "citation",
                targetClaimRefs: ["c_existing01"],
              },
            ],
            relations: [],
            inferredSpeaker: "A",
            speakerConfidence: 0.5,
          },
          baseOpts({
            existingClaims: [
              {
                id: "c_existing01",
                text: "Claim",
                speaker: "A",
                nature: "argument",
                createdAt: 1,
              },
            ],
            existingEvidence: [existing],
          }),
        );
        expect(result.evidence[0].id).toBe("ev_existing01");
        expect(result.evidence[0].createdAt).toBe(2000);
        expect(result.evidence[0].verification.status).toBe("corroborated");
        expect(result.evidence[0].verification.sources).toEqual([
          { uri: "https://example.com" },
        ]);
      },
    },
    {
      name: "drops orphan evidence with unresolved targets",
      run: () => {
        const result = normalizeModelExtract(
          {
            claims: [],
            evidence: [
              {
                clientId: "e1",
                text: "orphan",
                speaker: "A",
                kind: "reasoning",
                targetClaimRefs: ["missing"],
              },
            ],
            relations: [],
            inferredSpeaker: "A",
            speakerConfidence: 0.5,
          },
          baseOpts(),
        );
        expect(result.evidence).toHaveLength(0);
        expect(result.notes).toMatch(/orphan/i);
      },
    },
    {
      name: "drops self-relations and ev_ endpoints",
      run: () => {
        const result = normalizeModelExtract(
          {
            claims: [
              {
                clientId: "n1",
                text: "A",
                speaker: "A",
                nature: "argument",
              },
            ],
            evidence: [
              {
                clientId: "e1",
                text: "ev",
                speaker: "A",
                kind: "reasoning",
                targetClaimRefs: ["n1"],
              },
            ],
            relations: [
              { from: "n1", to: "n1", type: "counters" },
              { from: "e1", to: "n1", type: "responds_to" },
              { from: "n1", to: "ev_fake", type: "responds_to" },
            ],
            inferredSpeaker: "A",
            speakerConfidence: 0.5,
          },
          baseOpts(),
        );
        expect(result.relations).toHaveLength(0);
      },
    },
    {
      name: "dedupes relations by from|to|type",
      run: () => {
        const result = normalizeModelExtract(
          {
            claims: [
              {
                clientId: "n1",
                text: "A",
                speaker: "A",
                nature: "argument",
              },
              {
                clientId: "n2",
                text: "B",
                speaker: "B",
                nature: "counterargument",
              },
            ],
            evidence: [],
            relations: [
              { from: "n2", to: "n1", type: "counters" },
              { from: "n2", to: "n1", type: "counters" },
            ],
            inferredSpeaker: "B",
            speakerConfidence: 0.5,
          },
          baseOpts(),
        );
        expect(result.relations).toHaveLength(1);
      },
    },
    {
      name: "normalizes targetless counterargument to argument",
      run: () => {
        const result = normalizeModelExtract(
          {
            claims: [
              {
                clientId: "n1",
                text: "Opposite without target",
                speaker: "B",
                nature: "counterargument",
              },
            ],
            evidence: [],
            relations: [],
            inferredSpeaker: "B",
            speakerConfidence: 0.5,
          },
          baseOpts(),
        );
        expect(result.claims[0].nature).toBe("argument");
        expect(result.notes).toMatch(/targetless counterargument/i);
      },
    },
    {
      name: "remaps UNKNOWN speakers from inferredSpeaker",
      run: () => {
        const result = normalizeModelExtract(
          {
            claims: [
              {
                clientId: "n1",
                text: "Claim",
                speaker: "UNKNOWN",
                nature: "argument",
              },
            ],
            evidence: [
              {
                clientId: "e1",
                text: "Because",
                speaker: "UNKNOWN",
                kind: "reasoning",
                targetClaimRefs: ["n1"],
              },
            ],
            relations: [],
            inferredSpeaker: "B",
            speakerConfidence: 0.4,
          },
          baseOpts({ inferredSpeaker: "A" }),
        );
        expect(result.claims[0].speaker).toBe("A");
        expect(result.evidence[0].speaker).toBe("A");
        expect(result.inferredSpeaker).toBe("A");
      },
    },
    {
      name: "new evidence starts pending verification",
      run: () => {
        const result = normalizeModelExtract(
          {
            claims: [
              {
                clientId: "n1",
                text: "Claim",
                speaker: "A",
                nature: "argument",
              },
            ],
            evidence: [
              {
                clientId: "e1",
                text: "Fact",
                speaker: "A",
                kind: "factual_claim",
                targetClaimRefs: ["n1"],
              },
            ],
            relations: [],
            inferredSpeaker: "A",
            speakerConfidence: 0.5,
          },
          baseOpts(),
        );
        expect(result.evidence[0].verification).toMatchObject(pending);
      },
    },
  ])("$name", ({ run }) => {
    run();
  });
});
