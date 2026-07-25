import { describe, expect, it } from "vitest";

import {
  annotateClaimFallacies,
  heuristicFallacies,
  normalizeFallacies,
} from "@/lib/fallacy/detect";
import type { Claim } from "@/lib/extract/schema";

function claim(partial: Partial<Claim> & Pick<Claim, "id" | "text">): Claim {
  return {
    speaker: "A",
    nature: "argument",
    createdAt: 1,
    ...partial,
  };
}

describe("normalizeFallacies", () => {
  it.each([
    { name: "dedupes", input: ["ad_hominem", "ad_hominem"], expected: ["ad_hominem"] },
    { name: "filters junk", input: ["ad_hominem", "nope"], expected: ["ad_hominem"] },
    { name: "empty → undefined", input: [], expected: undefined },
  ])("$name", ({ input, expected }) => {
    expect(normalizeFallacies(input)).toEqual(expected);
  });
});

describe("heuristicFallacies", () => {
  it.each([
    {
      text: "You're stupid for thinking that",
      includes: "ad_hominem" as const,
    },
    {
      text: "So you're saying we should ban all cars",
      includes: "strawman" as const,
    },
    {
      text: "It's true because it is true",
      includes: "circular_reasoning" as const,
    },
  ])("detects $includes", ({ text, includes }) => {
    expect(heuristicFallacies(text)).toContain(includes);
  });
});

describe("annotateClaimFallacies", () => {
  it("adds fallacies via clientId map without changing nature", () => {
    const claims = [
      claim({ id: "c_1", text: "Remote work helps", nature: "argument" }),
    ];
    const before = structuredClone(claims[0]);

    const annotated = annotateClaimFallacies({
      claims,
      claimClientIds: ["n1"],
      modelByClientId: new Map([
        ["n1", { fallacies: ["false_dilemma"] }],
      ]),
    });

    expect(annotated[0].fallacies).toEqual(["false_dilemma"]);
    expect(annotated[0].nature).toBe(before.nature);
    expect(annotated[0].text).toBe(before.text);
    expect(annotated[0].speaker).toBe(before.speaker);
    expect(annotated[0].id).toBe(before.id);
    // Support is derived from Evidence elsewhere — claim shape has no unsupported flag
    expect(
      Object.prototype.hasOwnProperty.call(annotated[0], "unsupported"),
    ).toBe(false);
  });

  it("support-related fields stay unchanged when fallacy is added", () => {
    const claims = [
      claim({
        id: "c_1",
        text: "You're stupid if you disagree",
        nature: "counterargument",
      }),
    ];

    const annotated = annotateClaimFallacies({
      claims,
      claimClientIds: ["n1"],
      modelByClientId: new Map([["n1", { fallacies: ["ad_hominem"] }]]),
    });

    // Snapshot of fields that must not be mutated by fallacy annotation
    expect(annotated[0]).toMatchObject({
      id: "c_1",
      nature: "counterargument",
      speaker: "A",
      text: "You're stupid if you disagree",
      createdAt: 1,
      fallacies: ["ad_hominem"],
    });
    expect("unsupported" in annotated[0]).toBe(false);
    expect("type" in annotated[0]).toBe(false);
  });

  it("trusts empty model fallacies and skips heuristics", () => {
    const claims = [
      claim({
        id: "c_1",
        text: "You're stupid for thinking that",
      }),
    ];
    const annotated = annotateClaimFallacies({
      claims,
      claimClientIds: ["n1"],
      modelByClientId: new Map([["n1", { fallacies: [] }]]),
    });
    expect(annotated[0].fallacies).toBeUndefined();
  });

  it("falls back to heuristics when model omits fallacies key", () => {
    const claims = [
      claim({
        id: "c_1",
        text: "You're stupid for thinking that",
      }),
    ];
    const annotated = annotateClaimFallacies({
      claims,
      claimClientIds: ["n1"],
      modelByClientId: new Map([["n1", {}]]),
    });
    expect(annotated[0].fallacies).toContain("ad_hominem");
  });
});
