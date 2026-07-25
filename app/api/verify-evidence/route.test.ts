import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/verify-evidence/route";
import { VerifyError } from "@/lib/verify/errors";
import { resetVerifyLockForTests } from "@/lib/verify/lock";
import * as runVerifyMod from "@/lib/verify/runVerify";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/verify-evidence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseClaim = {
  id: "c1",
  text: "Remote work increases productivity",
  speaker: "A" as const,
  nature: "argument" as const,
  createdAt: 1,
};

const baseEvidence = {
  id: "ev1",
  text: "A 2023 meta-analysis found a 4% gain",
  speaker: "A" as const,
  supportsClaimIds: ["c1"],
  kind: "statistic" as const,
  verification: {
    status: "pending" as const,
    relevance: "pending" as const,
    sources: [] as [],
  },
  createdAt: 1,
};

afterEach(() => {
  resetVerifyLockForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/verify-evidence", () => {
  it("reports enabled/model without exposing keys", async () => {
    vi.stubEnv("ARGUS_VERIFY_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.enabled).toBe(true);
    expect(typeof body.model).toBe("string");
    expect(body.hasApiKey).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/AIza/);
  });
});

describe("POST /api/verify-evidence", () => {
  it("returns VERIFY_DISABLED when flag is false", async () => {
    vi.stubEnv("ARGUS_VERIFY_ENABLED", "false");
    const res = await POST(
      jsonRequest({ evidence: baseEvidence, claim: baseClaim }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("VERIFY_DISABLED");
  });

  it("rejects when claim id not in supportsClaimIds", async () => {
    vi.stubEnv("ARGUS_VERIFY_ENABLED", "true");
    const res = await POST(
      jsonRequest({
        evidence: { ...baseEvidence, supportsClaimIds: ["c_other"] },
        claim: baseClaim,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("short-circuits anecdote to not_verifiable without API key", async () => {
    vi.stubEnv("ARGUS_VERIFY_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "");
    const spy = vi.spyOn(runVerifyMod, "runVerifyEvidence");
    const res = await POST(
      jsonRequest({
        evidence: { ...baseEvidence, kind: "anecdote" },
        claim: baseClaim,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verification.status).toBe("not_verifiable");
    expect(spy).not.toHaveBeenCalled();
  });

  it("requires GEMINI_API_KEY only for searchable evidence", async () => {
    vi.stubEnv("ARGUS_VERIFY_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await POST(
      jsonRequest({ evidence: baseEvidence, claim: baseClaim }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("MISSING_KEY");
  });

  it("returns 200 for inconclusive from runVerify", async () => {
    vi.stubEnv("ARGUS_VERIFY_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.spyOn(runVerifyMod, "runVerifyEvidence").mockResolvedValue({
      evidenceId: "ev1",
      verification: {
        status: "inconclusive",
        relevance: "pending",
        sources: [],
        summary: "No grounded sources",
        checkedAt: 1,
      },
      displayStatusHint: "pending_confirmation",
    });

    const res = await POST(
      jsonRequest({ evidence: baseEvidence, claim: baseClaim }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verification.status).toBe("inconclusive");
  });

  it("returns 200 for not_verifiable from runVerify", async () => {
    vi.stubEnv("ARGUS_VERIFY_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.spyOn(runVerifyMod, "runVerifyEvidence").mockResolvedValue({
      evidenceId: "ev1",
      verification: {
        status: "not_verifiable",
        relevance: "weak",
        sources: [],
        summary: "Not externally verifiable",
        checkedAt: 1,
      },
      displayStatusHint: "not_externally_verifiable",
    });

    const res = await POST(
      jsonRequest({ evidence: baseEvidence, claim: baseClaim }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verification.status).toBe("not_verifiable");
  });

  it("maps RATE_LIMIT from verifier", async () => {
    vi.stubEnv("ARGUS_VERIFY_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.spyOn(runVerifyMod, "runVerifyEvidence").mockRejectedValue(
      new VerifyError("rate limited", "RATE_LIMIT", "RATE_LIMIT"),
    );

    const res = await POST(
      jsonRequest({ evidence: baseEvidence, claim: baseClaim }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMIT");
  });

  it("enforces in-process concurrency-one guard", async () => {
    vi.stubEnv("ARGUS_VERIFY_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("ARGUS_VERIFY_CONCURRENCY", "1");

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    vi.spyOn(runVerifyMod, "runVerifyEvidence").mockImplementation(async () => {
      await gate;
      return {
        evidenceId: "ev1",
        verification: {
          status: "inconclusive",
          relevance: "pending",
          sources: [],
          summary: "done",
          checkedAt: 1,
        },
      };
    });

    const first = POST(
      jsonRequest({ evidence: baseEvidence, claim: baseClaim }),
    );
    // Allow first request to acquire the lock
    await Promise.resolve();
    await Promise.resolve();

    const second = await POST(
      jsonRequest({
        evidence: { ...baseEvidence, id: "ev2" },
        claim: baseClaim,
      }),
    );
    expect(second.status).toBe(429);
    const body = await second.json();
    expect(body.code).toBe("RATE_LIMIT");

    release();
    const firstRes = await first;
    expect(firstRes.status).toBe(200);
  });
});
