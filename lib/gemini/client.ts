import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

/**
 * Server-only Gemini client (Google AI Studio / Gemini Developer API).
 *
 * Always uses `vertexai: false` so a machine-level
 * `GOOGLE_GENAI_USE_VERTEXAI=true` cannot redirect calls to Vertex
 * (which 403s AI Studio API keys).
 */
export function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Copy .env.example to .env.local and set the key.",
    );
  }
  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      // Critical: do not honor GOOGLE_GENAI_USE_VERTEXAI from the host env.
      vertexai: false,
    });
  }
  return client;
}

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
