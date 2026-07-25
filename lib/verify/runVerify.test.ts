import { describe, expect, it, vi } from "vitest";

import {
  finalizeModelVerification,
  runVerifyEvidence,
  type VerifyGenerateContentFn,
} from "@/lib/verify/runVerify";
import { VerifyError } from "@/lib/verify/errors";
import type { Claim, Evidence } from "@/lib/types/debate";

const claim: Claim = {
  id: "c_messi",
  text: "Messi is better",
  speaker: "A",
  nature: "argument",
  createdAt: 1,
};

function evidence(partial: Partial<Evidence> & Pick<Evidence, "id">): Evidence {
  return {
    text: "He won a World Cup and two Copa Américas",
    speaker: "A",
    supportsClaimIds: ["c_messi"],
    kind: "factual_claim",
    createdAt: 1,
    verification: {
      status: "pending",
      relevance: "pending",
      sources: [],
    },
    ...partial,
  };
}

const groundedMeta = {
  webSearchQueries: ["messi world cup"],
  groundingChunks: [
    {
      web: {
        uri: "https://example.com/messi",
        title: "Messi page",
        domain: "example.com",
      },
    },
  ],
};

function mockTwoPass(opts: {
  groundedText?: string;
  groundingMetadata?: unknown;
  structuredText?: string;
  groundedError?: Error;
  structuredError?: Error;
}): VerifyGenerateContentFn {
  return async (req) => {
    if (req.googleSearch) {
      if (opts.groundedError) throw opts.groundedError;
      return {
        text: opts.groundedText ?? "Sources align with the trophy record.",
        groundingMetadata: opts.groundingMetadata,
      };
    }
    if (opts.structuredError) throw opts.structuredError;
    return {
      text:
        opts.structuredText ??
        JSON.stringify({
          status: "corroborated",
          relevance: "strong",
          confidence: 0.8,
          summary: "Grounded sources align with the Evidence text.",
          sourceUris: ["https://example.com/messi"],
        }),
    };
  };
}

describe("finalizeModelVerification", () => {
  it("downgrades corroborated when sources empty after allowlist filter", () => {
    const result = finalizeModelVerification(
      {
        status: "corroborated",
        relevance: "strong",
        summary: "Aligned",
        sourceUris: ["https://invented.example/x"],
      },
      [{ uri: "https://example.com/real" }],
      ["q"],
      42,
    );
    expect(result.status).toBe("inconclusive");
    expect(result.sources).toEqual([]);
    expect(result.checkedAt).toBe(42);
  });

  it("keeps only allowlisted URIs", () => {
    const result = finalizeModelVerification(
      {
        status: "corroborated",
        relevance: "moderate",
        summary: "Sources align",
        sourceUris: [
          "https://example.com/messi",
          "https://evil.example/fake",
        ],
      },
      [
        {
          uri: "https://example.com/messi",
          title: "Messi page",
        },
      ],
      [],
    );
    expect(result.status).toBe("corroborated");
    expect(result.sources).toEqual([
      { uri: "https://example.com/messi", title: "Messi page" },
    ]);
  });
});

describe("runVerifyEvidence", () => {
  it("short-circuits anecdote to not_verifiable without calling Gemini", async () => {
    const generateContent = vi.fn();
    const result = await runVerifyEvidence({
      evidence: evidence({ id: "ev1", kind: "anecdote" }),
      claim,
      generateContent,
      now: 100,
    });
    expect(generateContent).not.toHaveBeenCalled();
    expect(result.verification.status).toBe("not_verifiable");
    expect(result.displayStatusHint).toBe("not_externally_verifiable");
  });

  it("returns corroborated with grounded sources", async () => {
    const claimCopy = { ...claim };
    const result = await runVerifyEvidence({
      evidence: evidence({ id: "ev1" }),
      claim: claimCopy,
      generateContent: mockTwoPass({ groundingMetadata: groundedMeta }),
      now: 200,
    });
    expect(result.verification.status).toBe("corroborated");
    expect(result.verification.sources).toEqual([
      {
        uri: "https://example.com/messi",
        title: "Messi page",
        domain: "example.com",
      },
    ]);
    expect(result.verification.webSearchQueries).toEqual(["messi world cup"]);
    expect(result.displayStatusHint).toBe("supported");
    // never mutate Claim
    expect(claimCopy).toEqual(claim);
  });

  it("returns contested from structured pass", async () => {
    const result = await runVerifyEvidence({
      evidence: evidence({ id: "ev1" }),
      claim,
      generateContent: mockTwoPass({
        groundingMetadata: groundedMeta,
        structuredText: JSON.stringify({
          status: "contested",
          relevance: "moderate",
          summary: "Grounded sources disagree about the Evidence claim.",
          sourceUris: ["https://example.com/messi"],
        }),
      }),
    });
    expect(result.verification.status).toBe("contested");
    expect(result.displayStatusHint).toBe("contested_evidence");
  });

  it("empty grounding yields inconclusive (never corroborated)", async () => {
    const result = await runVerifyEvidence({
      evidence: evidence({ id: "ev1" }),
      claim,
      generateContent: mockTwoPass({
        groundingMetadata: { webSearchQueries: ["q"], groundingChunks: [] },
      }),
    });
    expect(result.verification.status).toBe("inconclusive");
    expect(result.verification.sources).toEqual([]);
  });

  it("model not_verifiable with empty selected sources", async () => {
    const result = await runVerifyEvidence({
      evidence: evidence({ id: "ev1" }),
      claim,
      generateContent: mockTwoPass({
        groundingMetadata: groundedMeta,
        structuredText: JSON.stringify({
          status: "not_verifiable",
          relevance: "weak",
          summary: "Evidence is not suitable for external corroboration.",
          sourceUris: [],
        }),
      }),
    });
    expect(result.verification.status).toBe("not_verifiable");
  });

  it("removes unknown URIs from model output", async () => {
    const result = await runVerifyEvidence({
      evidence: evidence({ id: "ev1" }),
      claim,
      generateContent: mockTwoPass({
        groundingMetadata: groundedMeta,
        structuredText: JSON.stringify({
          status: "corroborated",
          relevance: "strong",
          summary: "Sources align",
          sourceUris: [
            "https://example.com/messi",
            "https://not-grounded.example/x",
          ],
        }),
      }),
    });
    expect(result.verification.sources.map((s) => s.uri)).toEqual([
      "https://example.com/messi",
    ]);
  });

  it("throws PARSE on malformed structured JSON", async () => {
    await expect(
      runVerifyEvidence({
        evidence: evidence({ id: "ev1" }),
        claim,
        generateContent: mockTwoPass({
          groundingMetadata: groundedMeta,
          structuredText: "not-json{{{",
        }),
      }),
    ).rejects.toMatchObject({
      name: "VerifyError",
      code: "PARSE",
    } satisfies Partial<VerifyError>);
  });

  it("retries once on 429 then succeeds", async () => {
    let calls = 0;
    const generateContent: VerifyGenerateContentFn = async (req) => {
      calls += 1;
      if (req.googleSearch && calls === 1) {
        const err = new Error("429 rate limit");
        throw err;
      }
      return mockTwoPass({ groundingMetadata: groundedMeta })(req);
    };
    const result = await runVerifyEvidence({
      evidence: evidence({ id: "ev1" }),
      claim,
      generateContent,
    });
    expect(result.verification.status).toBe("corroborated");
    expect(calls).toBeGreaterThan(1);
  });

  it("maps persistent 429 to RATE_LIMIT", async () => {
    const generateContent: VerifyGenerateContentFn = async () => {
      throw new Error("429 Too Many Requests");
    };
    await expect(
      runVerifyEvidence({
        evidence: evidence({ id: "ev1" }),
        claim,
        generateContent,
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT" });
  });
});
