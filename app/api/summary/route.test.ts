import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/summary/route";
import * as client from "@/lib/gemini/client";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/summary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sampleBody = {
  claims: [
    {
      id: "c1",
      text: "Messi is better",
      speaker: "A",
      nature: "argument",
      createdAt: 1,
    },
    {
      id: "c2",
      text: "Ronaldo is better",
      speaker: "B",
      nature: "counterargument",
      createdAt: 1,
    },
  ],
  evidence: [
    {
      id: "ev1",
      text: "Won a World Cup and two Copa Américas",
      speaker: "A",
      supportsClaimIds: ["c1"],
      kind: "factual_claim",
      verification: {
        status: "pending",
        relevance: "pending",
        sources: [],
      },
      createdAt: 1,
    },
  ],
  relations: [
    {
      id: "r1",
      from: "c2",
      to: "c1",
      type: "counters",
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/summary", () => {
  it("reports summary v2 health", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.purpose).toBe("summary v2");
  });
});

describe("POST /api/summary", () => {
  it("returns deterministic stats + debateScore without API key (fallback narrative)", async () => {
    vi.spyOn(client, "hasGeminiApiKey").mockReturnValue(false);

    const res = await POST(jsonRequest(sampleBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.claimCount).toBe(2);
    expect(body.evidenceCount).toBe(1);
    expect(body.unsupportedCount).toBe(1);
    expect(body.pendingEvidenceCount).toBe(1);
    expect(body.mostContestedClaimId).toBe("c1");
    expect(body.debateScore).toBeDefined();
    expect(body.debateScore.scoreA + body.debateScore.scoreB).toBe(100);
    expect(body.narrative).toBeTruthy();
    expect(body.narrative).not.toMatch(/\btrue\b|\bfalse\b/i);
  });

  it("returns empty-graph fallback with required debateScore", async () => {
    const res = await POST(
      jsonRequest({ claims: [], evidence: [], relations: [] }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.claimCount).toBe(0);
    expect(body.evidenceCount).toBe(0);
    expect(body.debateScore.leader).toBe("tied");
    expect(body.narrative).toMatch(/No claims/i);
  });

  it("falls back when Gemini fails but still returns stats + score", async () => {
    vi.spyOn(client, "hasGeminiApiKey").mockReturnValue(true);
    vi.spyOn(client, "getGenAI").mockReturnValue({
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error("boom")),
      },
    } as never);

    const res = await POST(jsonRequest(sampleBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.evidenceCount).toBe(1);
    expect(body.debateScore).toBeDefined();
    expect(body.narrative).toBeTruthy();
  });

  it("uses model narrative when Gemini succeeds", async () => {
    vi.spyOn(client, "hasGeminiApiKey").mockReturnValue(true);
    vi.spyOn(client, "getGenAI").mockReturnValue({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            mostContestedClaimId: "c1",
            narrative:
              "Speaker A offered evidence pending confirmation; Speaker B countered with a relation. Sources have not yet corroborated the trophy claim.",
          }),
        }),
      },
    } as never);

    const res = await POST(jsonRequest(sampleBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.narrative).toMatch(/pending confirmation/i);
    expect(body.debateScore.scoreA + body.debateScore.scoreB).toBe(100);
  });

  it("rejects legacy edges-only shaped claims missing nature", async () => {
    const res = await POST(
      jsonRequest({
        claims: [
          {
            id: "c1",
            text: "x",
            speaker: "A",
            type: "needs_evidence",
            createdAt: 1,
          },
        ],
        edges: [],
      }),
    );
    expect(res.status).toBe(400);
  });
});
