import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { extractResponseSchema } from "@/lib/extract/schema";

const fixturesDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureFiles = readdirSync(path.join(fixturesDir, "fixtures")).filter(
  (name) => name.endsWith(".json"),
);

describe("extract fixtures", () => {
  it("loads the expected fixture set", () => {
    expect(fixtureFiles.sort()).toEqual(
      [
        "claim-only.json",
        "contested-evidence.json",
        "contradict-edge.json",
        "messi-evidence.json",
        "not-verifiable-anecdote.json",
        "support-edge.json",
      ].sort(),
    );
  });

  it.each(fixtureFiles.map((file) => ({ file })))(
    "validates $file against ExtractResponse schema",
    ({ file }) => {
      const raw = JSON.parse(
        readFileSync(path.join(fixturesDir, "fixtures", file), "utf8"),
      );
      const parsed = extractResponseSchema.safeParse(raw);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    },
  );

  it("messi fixture has one claim, one evidence, no relations", () => {
    const raw = JSON.parse(
      readFileSync(
        path.join(fixturesDir, "fixtures", "messi-evidence.json"),
        "utf8",
      ),
    );
    expect(raw.claims).toHaveLength(1);
    expect(raw.evidence).toHaveLength(1);
    expect(raw.relations).toHaveLength(0);
    expect(raw.evidence[0].supportsClaimIds).toEqual([raw.claims[0].id]);
  });

  it("support-edge fixture has evidence but no support relation", () => {
    const raw = JSON.parse(
      readFileSync(
        path.join(fixturesDir, "fixtures", "support-edge.json"),
        "utf8",
      ),
    );
    expect(raw.evidence.length).toBeGreaterThan(0);
    expect(raw.relations).toEqual([]);
    expect(
      raw.relations.every(
        (r: { type: string }) => r.type !== "supports",
      ),
    ).toBe(true);
  });

  it("contradict-edge fixture uses counters relation", () => {
    const raw = JSON.parse(
      readFileSync(
        path.join(fixturesDir, "fixtures", "contradict-edge.json"),
        "utf8",
      ),
    );
    expect(raw.claims[0].nature).toBe("counterargument");
    expect(raw.relations[0].type).toBe("counters");
  });
});
