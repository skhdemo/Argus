import { describe, expect, it } from "vitest";

import {
  canCorroborate,
  filterAllowlistedSources,
  parseGroundingMetadata,
} from "@/lib/verify/parseGrounding";

describe("parseGroundingMetadata", () => {
  it("parses webSearchQueries and groundingChunks web.uri", () => {
    const parsed = parseGroundingMetadata({
      webSearchQueries: ["messi world cup", "copa america"],
      groundingChunks: [
        {
          web: {
            uri: "https://example.com/a",
            title: "A",
            domain: "example.com",
          },
        },
        { web: { uri: "https://example.com/b", title: "B" } },
      ],
    });
    expect(parsed.webSearchQueries).toEqual([
      "messi world cup",
      "copa america",
    ]);
    expect(parsed.sources).toEqual([
      {
        uri: "https://example.com/a",
        title: "A",
        domain: "example.com",
      },
      { uri: "https://example.com/b", title: "B" },
    ]);
  });

  it("dedupes URIs and ignores non-web chunks", () => {
    const parsed = parseGroundingMetadata({
      webSearchQueries: ["q", "q"],
      groundingChunks: [
        { web: { uri: "https://example.com/a" } },
        { web: { uri: "https://example.com/a" } },
        { retrievedContext: { uri: "https://evil.example/fake" } },
        { web: { uri: "not-a-url" } },
      ],
    });
    expect(parsed.webSearchQueries).toEqual(["q"]);
    expect(parsed.sources).toEqual([{ uri: "https://example.com/a" }]);
  });

  it("returns empty sources when grounding missing", () => {
    expect(parseGroundingMetadata(undefined)).toEqual({
      webSearchQueries: [],
      sources: [],
    });
    expect(parseGroundingMetadata({})).toEqual({
      webSearchQueries: [],
      sources: [],
    });
  });
});

describe("canCorroborate / filterAllowlistedSources", () => {
  it("empty grounding can never corroborate", () => {
    expect(canCorroborate([])).toBe(false);
  });

  it("never trusts non-grounded URLs", () => {
    const allowlist = [
      { uri: "https://grounded.example/a", title: "A" },
      { uri: "https://grounded.example/b" },
    ];
    const filtered = filterAllowlistedSources(
      [
        "https://grounded.example/a",
        "https://invented.example/fake",
        "https://grounded.example/b",
        "https://grounded.example/a",
      ],
      allowlist,
    );
    expect(filtered).toEqual([
      { uri: "https://grounded.example/a", title: "A" },
      { uri: "https://grounded.example/b" },
    ]);
  });
});
