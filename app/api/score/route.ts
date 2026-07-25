import { NextResponse } from "next/server";
import { z } from "zod";

import {
  claimSchema,
  evidenceSchema,
  relationSchema,
} from "@/lib/extract/schema";
import {
  SCORE_MAX_CLAIMS,
  SCORE_MAX_EVIDENCE,
  SCORE_MAX_RELATIONS,
} from "@/lib/score/constants";
import {
  computeDebateScore,
  toDebateScorePayload,
  type DebateScoreBreakdown,
} from "@/lib/score/debateScore";
import type { ApiErrorBody, ScoreResponse } from "@/lib/types/debate";

export const runtime = "nodejs";

const scoreRequestSchema = z.object({
  claims: z.array(claimSchema).default([]),
  evidence: z.array(evidenceSchema).default([]),
  relations: z.array(relationSchema).default([]),
});

function errorJson(
  status: number,
  body: ApiErrorBody,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(body, { status });
}

function wantsDebug(request: Request): boolean {
  const url = new URL(request.url);
  const value = url.searchParams.get("debug");
  return value === "1" || value === "true";
}

/** Health / docs pointer */
export async function GET() {
  return NextResponse.json({
    ok: true,
    purpose: "deterministic score v2",
    docs: "docs/DEBATE_SCORING.md",
  });
}

export type ScoreDebugResponse = ScoreResponse & {
  debug: {
    claimScores: DebateScoreBreakdown["claimScores"];
    evidenceScores: DebateScoreBreakdown["evidenceScores"];
    relationScores: DebateScoreBreakdown["relationScores"];
  };
};

/**
 * POST { claims, evidence, relations } → speaker scores (v2 formula).
 * Does not call Gemini — safe for tight UI loops. No API key required.
 * Optional `?debug=1` returns claim/evidence/relation breakdowns.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<ScoreResponse | ScoreDebugResponse | ApiErrorBody>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorJson(400, {
      error: "Request body must be JSON",
      code: "BAD_REQUEST",
    });
  }

  const parsed = scoreRequestSchema.safeParse(json);
  if (!parsed.success) {
    return errorJson(400, {
      error:
        parsed.error.issues.map((i) => i.message).join("; ") || "Invalid body",
      code: "BAD_REQUEST",
    });
  }

  const { claims, evidence, relations } = parsed.data;

  if (
    claims.length > SCORE_MAX_CLAIMS ||
    evidence.length > SCORE_MAX_EVIDENCE ||
    relations.length > SCORE_MAX_RELATIONS
  ) {
    return errorJson(400, {
      error: `Payload too large (max ${SCORE_MAX_CLAIMS} claims, ${SCORE_MAX_EVIDENCE} evidence, ${SCORE_MAX_RELATIONS} relations)`,
      code: "BAD_REQUEST",
    });
  }

  const breakdown = computeDebateScore(claims, evidence, relations);
  const snapshot = toDebateScorePayload(breakdown);

  const result: ScoreResponse = {
    ...snapshot,
    undercutA: breakdown.undercutA,
    undercutB: breakdown.undercutB,
  };

  if (wantsDebug(request)) {
    const debugResult: ScoreDebugResponse = {
      ...result,
      debug: {
        claimScores: breakdown.claimScores,
        evidenceScores: breakdown.evidenceScores,
        relationScores: breakdown.relationScores,
      },
    };
    return NextResponse.json(debugResult);
  }

  return NextResponse.json(result);
}
