import { describe, expect, it } from "vitest";

import {
  deriveClaimDisplayStatus,
  deriveSpeakerSupport,
} from "@/lib/debate/status";
import type { Evidence, EvidenceVerification } from "@/lib/types/debate";

function verification(
  partial: Pick<EvidenceVerification, "status" | "relevance"> &
    Partial<EvidenceVerification>,
): EvidenceVerification {
  return {
    sources: [],
    ...partial,
  };
}

function evidence(
  partial: Pick<Evidence, "id" | "supportsClaimIds"> &
    Partial<Evidence> & {
      verification: EvidenceVerification;
    },
): Evidence {
  return {
    text: partial.text ?? partial.id,
    speaker: partial.speaker ?? "A",
    kind: partial.kind ?? "factual_claim",
    createdAt: partial.createdAt ?? 1,
    ...partial,
  };
}

describe("deriveSpeakerSupport", () => {
  it.each([
    {
      name: "unsupported when no evidence",
      claimId: "c1",
      items: [] as Evidence[],
      expected: "unsupported" as const,
    },
    {
      name: "unsupported when evidence targets other claims",
      claimId: "c1",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c2"],
          verification: verification({
            status: "pending",
            relevance: "pending",
          }),
        }),
      ],
      expected: "unsupported" as const,
    },
    {
      name: "evidence_provided when attached",
      claimId: "c1",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "pending",
            relevance: "pending",
          }),
        }),
      ],
      expected: "evidence_provided" as const,
    },
  ])("$name", ({ claimId, items, expected }) => {
    expect(deriveSpeakerSupport(claimId, items)).toBe(expected);
  });
});

describe("deriveClaimDisplayStatus — precedence", () => {
  it.each([
    {
      name: "no evidence → unsupported",
      items: [] as Evidence[],
      expected: "unsupported" as const,
    },
    {
      name: "relevant corroborated → supported",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "corroborated",
            relevance: "strong",
          }),
        }),
      ],
      expected: "supported" as const,
    },
    {
      name: "moderate corroborated → supported",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "corroborated",
            relevance: "moderate",
          }),
        }),
      ],
      expected: "supported" as const,
    },
    {
      name: "corroborated+contested → supported (relevant wins)",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "contested",
            relevance: "moderate",
          }),
        }),
        evidence({
          id: "ev2",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "corroborated",
            relevance: "strong",
          }),
        }),
      ],
      expected: "supported" as const,
    },
    {
      name: "contested without relevant corroboration → contested_evidence",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "contested",
            relevance: "moderate",
          }),
        }),
        evidence({
          id: "ev2",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "pending",
            relevance: "pending",
          }),
        }),
      ],
      expected: "contested_evidence" as const,
    },
    {
      name: "weak corroborated beats pending → weak_support",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "corroborated",
            relevance: "weak",
          }),
        }),
        evidence({
          id: "ev2",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "pending",
            relevance: "pending",
          }),
        }),
      ],
      expected: "weak_support" as const,
    },
    {
      name: "irrelevant corroborated → weak_support",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "corroborated",
            relevance: "irrelevant",
          }),
        }),
      ],
      expected: "weak_support" as const,
    },
    {
      name: "contested beats weak corroborated",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "corroborated",
            relevance: "weak",
          }),
        }),
        evidence({
          id: "ev2",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "contested",
            relevance: "strong",
          }),
        }),
      ],
      expected: "contested_evidence" as const,
    },
    {
      name: "pending only → pending_confirmation",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "pending",
            relevance: "pending",
          }),
        }),
      ],
      expected: "pending_confirmation" as const,
    },
    {
      name: "inconclusive/error only → pending_confirmation",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "inconclusive",
            relevance: "moderate",
          }),
        }),
        evidence({
          id: "ev2",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "error",
            relevance: "pending",
            errorCode: "TIMEOUT",
          }),
        }),
      ],
      expected: "pending_confirmation" as const,
    },
    {
      name: "only not_verifiable → not_externally_verifiable",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          kind: "anecdote",
          verification: verification({
            status: "not_verifiable",
            relevance: "weak",
          }),
        }),
      ],
      expected: "not_externally_verifiable" as const,
    },
    {
      name: "pending beats only not_verifiable",
      items: [
        evidence({
          id: "ev1",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "not_verifiable",
            relevance: "weak",
          }),
        }),
        evidence({
          id: "ev2",
          supportsClaimIds: ["c1"],
          verification: verification({
            status: "pending",
            relevance: "pending",
          }),
        }),
      ],
      expected: "pending_confirmation" as const,
    },
  ])("$name", ({ items, expected }) => {
    expect(deriveClaimDisplayStatus("c1", items)).toBe(expected);
  });
});
