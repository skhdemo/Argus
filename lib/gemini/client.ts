import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

/**
 * Server-only Gemini client. Reads GEMINI_API_KEY from the environment.
 */
export function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Copy .env.example to .env.local and set the key.",
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
