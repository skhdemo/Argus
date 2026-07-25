import { NextResponse } from "next/server";

import { getGenAI, hasGeminiApiKey } from "@/lib/gemini/client";
import { GEMINI_MODEL } from "@/lib/gemini/models";
import { computeDebateScore, toDebateScorePayload } from "@/lib/score/debateScore";
import {
  SUMMARY_SYSTEM_PROMPT,
  buildSummaryUserPrompt,
} from "@/lib/summary/prompt";
import {
  modelSummaryJsonSchema,
  modelSummarySchema,
  summaryRequestSchema,
} from "@/lib/summary/schema";
import {
  buildFallbackNarrative,
  computeSummaryStats,
  resolveMostContestedClaimId,
} from "@/lib/summary/stats";
import type {
  ApiErrorBody,
  DebateScoreSnapshot,
  SummaryResponse,
} from "@/lib/types/debate";

export const runtime = "nodejs";

function errorJson(
  status: number,
  body: ApiErrorBody,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(body, { status });
}

/** Health check */
export async function GET() {
  return NextResponse.json({
    ok: true,
    purpose: "summary v2",
    model: GEMINI_MODEL,
    hasApiKey: hasGeminiApiKey(),
  });
}

/**
 * POST { claims, evidence, relations } → SummaryResponse.
 * Stats + debateScore are always deterministic.
 * Narrative uses Gemini when available; falls back on failure (never drops score/stats).
 */
export async function POST(
  request: Request,
): Promise<NextResponse<SummaryResponse | ApiErrorBody>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorJson(400, {
      error: "Request body must be JSON",
      code: "BAD_REQUEST",
    });
  }

  const parsed = summaryRequestSchema.safeParse(json);
  if (!parsed.success) {
    return errorJson(400, {
      error:
        parsed.error.issues.map((i) => i.message).join("; ") || "Invalid body",
      code: "BAD_REQUEST",
    });
  }

  const { claims, evidence, relations } = parsed.data;
  const stats = computeSummaryStats(claims, evidence, relations);
  const debateScore: DebateScoreSnapshot = toDebateScorePayload(
    computeDebateScore(claims, evidence, relations),
  );

  const fallback: SummaryResponse = {
    ...stats,
    narrative: buildFallbackNarrative(stats),
    debateScore,
  };

  if (claims.length === 0) {
    return NextResponse.json(fallback);
  }

  if (!hasGeminiApiKey()) {
    console.info("[api/summary]", {
      path: "fallback",
      reason: "MISSING_KEY",
      claimCount: stats.claimCount,
      evidenceCount: stats.evidenceCount,
    });
    return NextResponse.json(fallback);
  }

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildSummaryUserPrompt(claims, evidence, relations),
      config: {
        systemInstruction: SUMMARY_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: modelSummaryJsonSchema,
        temperature: 0.3,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      console.info("[api/summary]", { path: "fallback", reason: "empty" });
      return NextResponse.json(fallback);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      console.info("[api/summary]", { path: "fallback", reason: "PARSE" });
      return NextResponse.json(fallback);
    }

    const modelParsed = modelSummarySchema.safeParse(raw);
    if (!modelParsed.success) {
      console.info("[api/summary]", { path: "fallback", reason: "schema" });
      return NextResponse.json(fallback);
    }

    const narrative = modelParsed.data.narrative.trim();
    const result: SummaryResponse = {
      ...stats,
      mostContestedClaimId: resolveMostContestedClaimId(
        modelParsed.data.mostContestedClaimId,
        claims,
        stats.mostContestedClaimId,
      ),
      narrative: narrative.length > 0 ? narrative : fallback.narrative,
      debateScore,
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream Gemini error";
    console.error("[api/summary]", {
      path: "fallback",
      reason: "UPSTREAM",
      error: message,
    });
    // Never fail the route for narrative errors — stats + score still land.
    return NextResponse.json(fallback);
  }
}
