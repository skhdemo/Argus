import { NextResponse } from "next/server";

import { getGenAI, hasGeminiApiKey } from "@/lib/gemini/client";
import { GEMINI_MODEL } from "@/lib/gemini/models";
import { normalizeModelExtract } from "@/lib/extract/merge";
import {
  EXTRACT_SYSTEM_PROMPT,
  buildExtractUserPrompt,
} from "@/lib/extract/prompt";
import {
  extractRequestSchema,
  modelExtractJsonSchema,
  modelExtractSchema,
} from "@/lib/extract/schema";
import type { ApiErrorBody, ExtractResponse } from "@/lib/types/debate";

export const runtime = "nodejs";

function errorJson(
  status: number,
  body: ApiErrorBody,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(body, { status });
}

/** Health / model pin check for FE + local smoke tests */
export async function GET() {
  return NextResponse.json({
    ok: true,
    model: GEMINI_MODEL,
    hasApiKey: hasGeminiApiKey(),
  });
}

export async function POST(
  request: Request,
): Promise<NextResponse<ExtractResponse | ApiErrorBody>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorJson(400, {
      error: "Request body must be JSON",
      code: "BAD_REQUEST",
    });
  }

  const parsed = extractRequestSchema.safeParse(json);
  if (!parsed.success) {
    return errorJson(400, {
      error: parsed.error.issues.map((i) => i.message).join("; ") || "Invalid body",
      code: "BAD_REQUEST",
    });
  }

  if (!hasGeminiApiKey()) {
    return errorJson(500, {
      error:
        "GEMINI_API_KEY is missing. Copy .env.example to .env.local and set the key.",
      code: "MISSING_KEY",
    });
  }

  const body = parsed.data;

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildExtractUserPrompt(body),
      config: {
        systemInstruction: EXTRACT_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: modelExtractJsonSchema,
        temperature: 0.2,
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

    const modelParsed = modelExtractSchema.safeParse(raw);
    if (!modelParsed.success) {
      return errorJson(502, {
        error: `Gemini JSON failed schema: ${modelParsed.error.issues
          .map((i) => i.message)
          .join("; ")}`,
        code: "PARSE",
      });
    }

    // BE2: replace stub with inferSpeaker(...) from lib/speaker/infer.ts
    const result = normalizeModelExtract(modelParsed.data, {
      inferredSpeaker: body.inferredSpeaker,
      stubSpeaker: true,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream Gemini error";
    if (message.includes("GEMINI_API_KEY")) {
      return errorJson(500, { error: message, code: "MISSING_KEY" });
    }
    console.error("[api/extract]", message);
    return errorJson(502, { error: message, code: "UPSTREAM" });
  }
}
