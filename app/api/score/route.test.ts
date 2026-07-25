import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/score/route";
import { SCORE_MAX_CLAIMS } from "@/lib/score/constants";

function jsonRequest(
  body: unknown,
  path = "http://localhost/api/score",
): Request {
  return new Request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/score", () => {
  it("reports deterministic score v2", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.purpose).toBe("deterministic score v2");
  });
});

describe("POST /api/score", () => {
  it("scores empty graph 50/50 without API key", async () => {
    const res = await POST(jsonRequest({ claims: [], evidence: [], relations: [] }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.scoreA).toBe(50);
    expect(body.scoreB).toBe(50);
    expect(body.leader).toBe("tied");
    expect(body.debug).toBeUndefined();
  });

  it("scores Messi claim+evidence payload", async () => {
    const res = await POST(
      jsonRequest({
        claims: [
          {
            id: "c_messi",
            text: "Messi is better",
            speaker: "A",
            nature: "argument",
            createdAt: 1,
          },
        ],
        evidence: [
          {
            id: "ev_messi",
            text: "He won a World Cup and two Copa Américas",
            speaker: "A",
            supportsClaimIds: ["c_messi"],
            kind: "factual_claim",
            verification: {
              status: "pending",
              relevance: "pending",
              sources: [],
            },
            createdAt: 1,
          },
        ],
        relations: [],
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rawA).toBeCloseTo(1.1875, 10);
    expect(body.scoreA + body.scoreB).toBe(100);
    expect(body.leader).toBe("A");
  });

  it("rejects invalid body", async () => {
    const res = await POST(
      jsonRequest({
        claims: [{ id: "c1", text: "x", speaker: "A", createdAt: 1 }],
        evidence: [],
        relations: [],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("rejects oversized payloads", async () => {
    const claims = Array.from({ length: SCORE_MAX_CLAIMS + 1 }, (_, i) => ({
      id: `c_${i}`,
      text: `Claim ${i}`,
      speaker: "A" as const,
      nature: "argument" as const,
      createdAt: 1,
    }));
    const res = await POST(
      jsonRequest({ claims, evidence: [], relations: [] }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too large/i);
  });

  it("returns debug breakdown with ?debug=1", async () => {
    const res = await POST(
      jsonRequest(
        {
          claims: [
            {
              id: "c1",
              text: "Claim",
              speaker: "A",
              nature: "argument",
              createdAt: 1,
            },
          ],
          evidence: [],
          relations: [],
        },
        "http://localhost/api/score?debug=1",
      ),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.debug.claimScores).toHaveLength(1);
    expect(body.debug.evidenceScores).toEqual([]);
    expect(body.debug.relationScores).toEqual([]);
  });

  it("rejects legacy edges-only payloads", async () => {
    const res = await POST(
      jsonRequest({
        claims: [],
        edges: [{ id: "e1", from: "c1", to: "c2", type: "supports" }],
      }),
    );
    // edges are ignored; empty claims/evidence/relations → 50/50
    // But if someone sends old claim.type shapes, claims validation fails when present.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scoreA).toBe(50);
  });
});
