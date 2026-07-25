import { NextResponse } from "next/server";

import { getGenAI, hasGeminiApiKey } from "@/lib/gemini/client";
import { GEMINI_MODEL } from "@/lib/gemini/models";
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
  computeSummaryStats,
  resolveMostContestedClaimId,
} from "@/lib/summary/stats";
import { computeDebateScore, toDebateScorePayload } from "@/lib/score/debateScore";
import type { ApiErrorBody, DebateScoreSnapshot, SummaryResponse } from "@/lib/types/debate";

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
    model: GEMINI_MODEL,
    hasApiKey: hasGeminiApiKey(),
  });
}

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

  const { claims, edges } = parsed.data;
  const stats = computeSummaryStats(claims, edges);
  // Phase F will pass real evidence/relations; keep score v2 callable until then.
  const debateScore: DebateScoreSnapshot = toDebateScorePayload(
    computeDebateScore(claims, [], []),
  );

  if (claims.length === 0) {
    return NextResponse.json({
      ...stats,
      mostContestedClaimId: null,
      narrative:
        "No claims extracted yet. Structural summary will appear after the debate graph has content.",
      debateScore,
    });
  }

  if (!hasGeminiApiKey()) {
    return errorJson(500, {
      error:
        "GEMINI_API_KEY is missing. Copy .env.example to .env.local and set the key.",
      code: "MISSING_KEY",
    });
  }

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildSummaryUserPrompt(claims, edges),
      config: {
        systemInstruction: SUMMARY_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: modelSummaryJsonSchema,
        temperature: 0.3,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return errorJson(502, {
        error: "Empty response from Gemini",
        code: "UPSTREAM",
      });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return errorJson(502, {
        error: "Gemini returned non-JSON content",
        code: "PARSE",
      });
    }

    const modelParsed = modelSummarySchema.safeParse(raw);
    if (!modelParsed.success) {
      return errorJson(502, {
        error: `Gemini JSON failed schema: ${modelParsed.error.issues
          .map((i) => i.message)
          .join("; ")}`,
        code: "PARSE",
      });
    }

    const result: SummaryResponse = {
      claimCount: stats.claimCount,
      evidenceCount: stats.evidenceCount,
      unsupportedCount: stats.unsupportedCount,
      mostContestedClaimId: resolveMostContestedClaimId(
        modelParsed.data.mostContestedClaimId,
        claims,
        stats.mostContestedClaimId,
      ),
      narrative: modelParsed.data.narrative.trim(),
      debateScore,
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream Gemini error";
    if (message.includes("GEMINI_API_KEY")) {
      return errorJson(500, { error: message, code: "MISSING_KEY" });
    }
    console.error("[api/summary]", message);
    return errorJson(502, { error: message, code: "UPSTREAM" });
  }
}
