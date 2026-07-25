import { describe, expect, it } from "vitest";

import {
  RECENTLY_COMPLETED_MS,
  isRecentlyCompleted,
  isSearchableKind,
  selectEvidenceForVerify,
} from "@/lib/verify/select";
import type { Evidence, EvidenceKind } from "@/lib/types/debate";

function evidence(
  partial: Pick<Evidence, "id" | "kind"> & Partial<Evidence>,
): Evidence {
  return {
    text: partial.text ?? "evidence text",
    speaker: "A",
    supportsClaimIds: ["c1"],
    createdAt: 1,
    verification: {
      status: "pending",
      relevance: "pending",
      sources: [],
    },
    ...partial,
  };
}

describe("isSearchableKind", () => {
  it.each([
    ["statistic", true],
    ["citation", true],
    ["factual_claim", true],
    ["example", true],
    ["authority", true],
    ["anecdote", false],
    ["reasoning", false],
  ] as const)("%s → %s", (kind, expected) => {
    expect(isSearchableKind(kind as EvidenceKind)).toBe(expected);
  });
});

describe("selectEvidenceForVerify", () => {
  it("short-circuits anecdote to not_verifiable without Search", () => {
    const result = selectEvidenceForVerify(
      evidence({ id: "ev1", kind: "anecdote" }),
      { now: 1000 },
    );
    expect(result.action).toBe("short_circuit");
    if (result.action !== "short_circuit") return;
    expect(result.verification.status).toBe("not_verifiable");
    expect(result.verification.sources).toEqual([]);
    expect(result.verification.checkedAt).toBe(1000);
  });

  it("short-circuits reasoning to not_verifiable", () => {
    const result = selectEvidenceForVerify(
      evidence({ id: "ev1", kind: "reasoning" }),
    );
    expect(result.action).toBe("short_circuit");
    if (result.action !== "short_circuit") return;
    expect(result.verification.status).toBe("not_verifiable");
  });

  it("selects searchable kinds for Search", () => {
    for (const kind of [
      "statistic",
      "citation",
      "factual_claim",
      "example",
      "authority",
    ] as const) {
      expect(
        selectEvidenceForVerify(evidence({ id: "ev", kind })).action,
      ).toBe("search");
    }
  });

  it("skips recently completed unless force", () => {
    const now = 1_000_000;
    const completed = evidence({
      id: "ev1",
      kind: "statistic",
      verification: {
        status: "corroborated",
        relevance: "strong",
        sources: [{ uri: "https://example.com" }],
        checkedAt: now - 60_000,
      },
    });

    const skipped = selectEvidenceForVerify(completed, { now });
    expect(skipped.action).toBe("skip");
    if (skipped.action !== "skip") return;
    expect(skipped.reason).toBe("recently_completed");
    expect(skipped.verification.status).toBe("corroborated");

    const forced = selectEvidenceForVerify(completed, { now, force: true });
    expect(forced.action).toBe("search");
  });

  it("allows re-verify of error status without force", () => {
    const result = selectEvidenceForVerify(
      evidence({
        id: "ev1",
        kind: "citation",
        verification: {
          status: "error",
          relevance: "pending",
          sources: [],
          errorCode: "TIMEOUT",
          checkedAt: Date.now(),
        },
      }),
    );
    expect(result.action).toBe("search");
  });

  it("isRecentlyCompleted respects window", () => {
    const now = 10_000;
    expect(
      isRecentlyCompleted(
        {
          status: "inconclusive",
          relevance: "pending",
          sources: [],
          checkedAt: now - (RECENTLY_COMPLETED_MS - 1),
        },
        now,
      ),
    ).toBe(true);
    expect(
      isRecentlyCompleted(
        {
          status: "inconclusive",
          relevance: "pending",
          sources: [],
          checkedAt: now - (RECENTLY_COMPLETED_MS + 1),
        },
        now,
      ),
    ).toBe(false);
  });
});
