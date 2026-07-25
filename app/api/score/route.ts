import { NextResponse } from "next/server";
import { z } from "zod";

import {
  computeDebateScore,
  toDebateScorePayload,
} from "@/lib/score/debateScore";
import { claimSchema, edgeSchema } from "@/lib/extract/schema";
import type { ApiErrorBody, ScoreResponse } from "@/lib/types/debate";

export const runtime = "nodejs";

const scoreRequestSchema = z.object({
  claims: z.array(claimSchema).default([]),
  edges: z.array(edgeSchema).default([]),
});

function errorJson(
  status: number,
  body: ApiErrorBody,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(body, { status });
}

/** Health / docs pointer */
export async function GET() {
  return NextResponse.json({
    ok: true,
    purpose: "Deterministic structural debate scoring (no Gemini)",
    docs: "docs/DEBATE_SCORING.md",
  });
}

/**
 * POST { claims, edges } → speaker scores from the graph formula.
 * Does not call Gemini — safe for tight UI loops once FE wires it.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<ScoreResponse | ApiErrorBody>> {
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

  const breakdown = computeDebateScore(parsed.data.claims, parsed.data.edges);
  const payload = toDebateScorePayload(breakdown);

  const result: ScoreResponse = {
    rawA: payload.rawA,
    rawB: payload.rawB,
    ratioA: payload.ratioA,
    ratioB: payload.ratioB,
    scoreA: payload.scoreA,
    scoreB: payload.scoreB,
    leader: payload.leader,
    leaderShare: payload.leaderShare,
    isDecisive: payload.isDecisive,
    undercutA: breakdown.undercutA,
    undercutB: breakdown.undercutB,
  };

  return NextResponse.json(result);
}
