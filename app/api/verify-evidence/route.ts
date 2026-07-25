import { NextResponse } from "next/server";

import { hasGeminiApiKey } from "@/lib/gemini/client";
import { deriveClaimDisplayStatus } from "@/lib/debate/status";
import { VerifyError } from "@/lib/verify/errors";
import { withVerifyLock, getVerifyConcurrencyLimit } from "@/lib/verify/lock";
import {
  getVerifyModel,
  isVerifyEnabled,
  runVerifyEvidence,
} from "@/lib/verify/runVerify";
import { selectEvidenceForVerify } from "@/lib/verify/select";
import { verifyEvidenceRequestSchema } from "@/lib/verify/schema";
import type {
  ApiErrorBody,
  VerifyEvidenceResponse,
} from "@/lib/types/debate";

export const runtime = "nodejs";

function errorJson(
  status: number,
  body: ApiErrorBody,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(body, { status });
}

function httpStatusForCode(code: ApiErrorBody["code"]): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "MISSING_KEY":
      return 500;
    case "VERIFY_DISABLED":
      return 503;
    case "RATE_LIMIT":
      return 429;
    case "TIMEOUT":
      return 504;
    case "BLOCKED":
      return 403;
    case "PARSE":
    case "UPSTREAM":
    default:
      return 502;
  }
}

/**
 * Health: enabled/model/key presence — never expose key material.
 *
 * Note: FE must also serialize verify calls globally; this process only
 * enforces in-instance concurrency via ARGUS_VERIFY_CONCURRENCY.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    purpose: "evidence verification v2",
    enabled: isVerifyEnabled(),
    model: getVerifyModel(),
    hasApiKey: hasGeminiApiKey(),
    concurrency: getVerifyConcurrencyLimit(),
  });
}

/**
 * POST { evidence, claim, force? } → VerifyEvidenceResponse.
 * not_verifiable / inconclusive → HTTP 200.
 * Google Search only on searchable kinds; anecdote/reasoning short-circuit.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<VerifyEvidenceResponse | ApiErrorBody>> {
  const started = Date.now();

  if (!isVerifyEnabled()) {
    return errorJson(503, {
      error: "Evidence verification is disabled (ARGUS_VERIFY_ENABLED=false)",
      code: "VERIFY_DISABLED",
    });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorJson(400, {
      error: "Request body must be JSON",
      code: "BAD_REQUEST",
    });
  }

  const parsed = verifyEvidenceRequestSchema.safeParse(json);
  if (!parsed.success) {
    return errorJson(400, {
      error:
        parsed.error.issues.map((i) => i.message).join("; ") || "Invalid body",
      code: "BAD_REQUEST",
    });
  }

  const { evidence, claim, force } = parsed.data;

  if (!evidence.supportsClaimIds.includes(claim.id)) {
    return errorJson(400, {
      error: `Claim id ${claim.id} is not in evidence.supportsClaimIds`,
      code: "BAD_REQUEST",
    });
  }

  // Eligibility before requiring API key — anecdote/reasoning need no Gemini.
  const selected = selectEvidenceForVerify(evidence, { force });
  if (selected.action === "short_circuit" || selected.action === "skip") {
    const verification = selected.verification;
    const result: VerifyEvidenceResponse = {
      evidenceId: evidence.id,
      verification,
      displayStatusHint: deriveClaimDisplayStatus(claim.id, [
        { ...evidence, verification },
      ]),
    };
    console.info("[api/verify-evidence]", {
      latencyMs: Date.now() - started,
      evidenceId: evidence.id,
      sourceCount: verification.sources.length,
      status: verification.status,
      path: selected.action,
    });
    return NextResponse.json(result);
  }

  if (!hasGeminiApiKey()) {
    return errorJson(500, {
      error:
        "GEMINI_API_KEY is missing. Copy .env.example to .env.local and set the key.",
      code: "MISSING_KEY",
    });
  }

  try {
    const result = await withVerifyLock(() =>
      runVerifyEvidence({ evidence, claim, force }),
    );

    console.info("[api/verify-evidence]", {
      latencyMs: Date.now() - started,
      evidenceId: result.evidenceId,
      sourceCount: result.verification.sources.length,
      status: result.verification.status,
    });

    return NextResponse.json(result);
  } catch (err) {
    const mapped =
      err instanceof VerifyError
        ? err
        : new VerifyError(
            err instanceof Error ? err.message : "Upstream Gemini error",
            "UPSTREAM",
            "UPSTREAM",
          );

    console.error("[api/verify-evidence]", {
      latencyMs: Date.now() - started,
      evidenceId: evidence.id,
      error: mapped.message,
      code: mapped.code,
    });

    return errorJson(httpStatusForCode(mapped.code), {
      error: mapped.message,
      code: mapped.code,
    });
  }
}
