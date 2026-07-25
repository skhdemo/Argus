import { NextResponse } from "next/server";

import { getGenAI, hasGeminiApiKey } from "@/lib/gemini/client";
import { GEMINI_MODEL } from "@/lib/gemini/models";
import {
  buildTranscribeUserPrompt,
  TRANSCRIBE_SYSTEM_PROMPT,
} from "@/lib/transcribe/prompt";
import {
  modelTranscribeJsonSchema,
  modelTranscribeSchema,
} from "@/lib/transcribe/schema";
import type {
  ApiErrorBody,
  SpeakerId,
  TranscribeResponse,
} from "@/lib/types/debate";

export const runtime = "nodejs";

/** Max upload size (~4MB) — keep chunks short for live demo latency */
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
]);

function errorJson(
  status: number,
  body: ApiErrorBody,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(body, { status });
}

function normalizeMime(raw: string | undefined): string {
  const mime = (raw || "audio/webm").split(";")[0].trim().toLowerCase();
  if (mime === "audio/webm" || mime.startsWith("audio/webm")) return "audio/webm";
  if (mime === "audio/ogg" || mime.startsWith("audio/ogg")) return "audio/ogg";
  if (mime === "audio/mp4") return "audio/mp4";
  if (mime === "audio/mpeg" || mime === "audio/mp3") return "audio/mpeg";
  if (mime === "audio/wav" || mime === "audio/x-wav") return "audio/wav";
  if (mime === "audio/flac") return "audio/flac";
  return mime;
}

function parseSpeaker(value: FormDataEntryValue | null): SpeakerId | null {
  if (value !== "A" && value !== "B" && value !== "UNKNOWN") return null;
  return value;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    model: GEMINI_MODEL,
    hasApiKey: hasGeminiApiKey(),
    purpose: "Gemini audio transcription + speaker diarization",
  });
}

/**
 * POST multipart/form-data:
 *   - audio: Blob/File (required)
 *   - lastSpeaker: A | B | UNKNOWN (optional)
 */
export async function POST(
  request: Request,
): Promise<NextResponse<TranscribeResponse | ApiErrorBody>> {
  if (!hasGeminiApiKey()) {
    return errorJson(500, {
      error:
        "GEMINI_API_KEY is missing. Copy .env.example to .env.local and set the key.",
      code: "MISSING_KEY",
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorJson(400, {
      error: "Expected multipart/form-data with an audio file",
      code: "BAD_REQUEST",
    });
  }

  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) {
    return errorJson(400, {
      error: "Missing or empty audio field",
      code: "BAD_REQUEST",
    });
  }

  if (file.size > MAX_BYTES) {
    return errorJson(400, {
      error: `Audio chunk too large (max ${MAX_BYTES} bytes)`,
      code: "BAD_REQUEST",
    });
  }

  const mime = normalizeMime(file.type);
  if (
    !ALLOWED_MIME.has(file.type) &&
    !ALLOWED_MIME.has(mime) &&
    !mime.startsWith("audio/")
  ) {
    return errorJson(400, {
      error: `Unsupported audio type: ${file.type || "unknown"}`,
      code: "BAD_REQUEST",
    });
  }

  const lastSpeaker = parseSpeaker(form.get("lastSpeaker"));
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: buildTranscribeUserPrompt({ lastSpeaker }) },
            {
              inlineData: {
                mimeType: mime || "audio/webm",
                data: base64,
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction: TRANSCRIBE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: modelTranscribeJsonSchema,
        temperature: 0.1,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return errorJson(502, {
        error: "Empty response from Gemini transcription",
        code: "UPSTREAM",
      });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return errorJson(502, {
        error: "Gemini transcription returned non-JSON",
        code: "PARSE",
      });
    }

    const parsed = modelTranscribeSchema.safeParse(raw);
    if (!parsed.success) {
      return errorJson(502, {
        error: `Transcription JSON failed schema: ${parsed.error.issues
          .map((i) => i.message)
          .join("; ")}`,
        code: "PARSE",
      });
    }

    const segments = parsed.data.segments
      .map((s) => ({
        speaker: s.speaker,
        text: s.text.trim(),
        timestamp: s.timestamp,
      }))
      .filter((s) => s.text.length > 0);

    const joined = segments.map((s) => s.text).join(" ").trim();
    const inferredSpeaker =
      parsed.data.inferredSpeaker !== "UNKNOWN"
        ? parsed.data.inferredSpeaker
        : (segments.at(-1)?.speaker ?? lastSpeaker ?? "UNKNOWN");

    const result: TranscribeResponse = {
      text: joined,
      segments,
      inferredSpeaker,
      speakerConfidence: parsed.data.speakerConfidence,
      notes: parsed.data.notes,
    };

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Upstream Gemini transcription error";
    if (message.includes("GEMINI_API_KEY")) {
      return errorJson(500, { error: message, code: "MISSING_KEY" });
    }
    console.error("[api/transcribe]", message);
    return errorJson(502, { error: message, code: "UPSTREAM" });
  }
}
