import { describe, expect, it } from "vitest";

import {
  findPrimaryClaim,
  isCompletedVerificationStatus,
  parseRetryAfterMs,
} from "@/hooks/evidenceVerificationQueue";
import type { Claim, Evidence } from "@/lib/types/debate";

const claims: Claim[] = [
  {
    id: "c_1",
    text: "First",
    speaker: "A",
    nature: "argument",
    createdAt: 1,
  },
  {
    id: "c_2",
    text: "Second",
    speaker: "B",
    nature: "counterargument",
    createdAt: 2,
  },
];

const pendingEvidence: Evidence = {
  id: "ev_1",
  text: "Evidence",
  speaker: "A",
  supportsClaimIds: ["missing", "c_2", "c_1"],
  kind: "citation",
  verification: {
    status: "pending",
    relevance: "pending",
    sources: [],
  },
  createdAt: 3,
};

describe("evidence verification queue helpers", () => {
  it("selects the first resolvable supported claim", () => {
    expect(findPrimaryClaim(pendingEvidence, claims)?.id).toBe("c_2");
    expect(
      findPrimaryClaim(
        { ...pendingEvidence, supportsClaimIds: ["missing"] },
        claims,
      ),
    ).toBeNull();
  });

  it.each(["corroborated", "contested", "inconclusive", "not_verifiable"] as const)(
    "treats %s as completed",
    (status) => {
      expect(isCompletedVerificationStatus(status)).toBe(true);
    },
  );

  it.each(["pending", "error"] as const)(
    "does not treat %s as completed",
    (status) => {
      expect(isCompletedVerificationStatus(status)).toBe(false);
    },
  );

  it("parses Retry-After seconds, dates, and fallbacks", () => {
    expect(parseRetryAfterMs("2", 1_000, 500)).toBe(2_000);
    expect(
      parseRetryAfterMs("Thu, 01 Jan 1970 00:00:03 GMT", 1_000, 500),
    ).toBe(2_000);
    expect(parseRetryAfterMs("invalid", 1_000, 500)).toBe(500);
    expect(parseRetryAfterMs(null, 1_000, 500)).toBe(500);
  });
});
