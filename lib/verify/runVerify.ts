/**
 * Two-pass Gemini Google Search Evidence verification.
 *
 * Pass 1: tools googleSearch, free prose + groundingMetadata (no JSON schema).
 * Pass 2: no tools, structured JSON with allowlisted sources only.
 *
 * Hard invariants:
 * - corroborated requires ≥1 grounded allowlisted source
 * - empty sources → inconclusive or not_verifiable (never corroborated)
 * - never mutates Claim speaker/nature/text
 */

import { deriveClaimDisplayStatus } from "@/lib/debate/status";
import { getGenAI } from "@/lib/gemini/client";
import { GEMINI_MODEL } from "@/lib/gemini/models";
import {
  canCorroborate,
  filterAllowlistedSources,
  parseGroundingMetadata,
} from "@/lib/verify/parseGrounding";
import {
  VERIFY_GROUNDED_SYSTEM_PROMPT,
  VERIFY_STRUCTURED_SYSTEM_PROMPT,
  buildGroundedUserPrompt,
  buildStructuredUserPrompt,
} from "@/lib/verify/prompt";
import {
  modelVerifyJsonSchema,
  modelVerifySchema,
  type ModelVerify,
} from "@/lib/verify/schema";
import { selectEvidenceForVerify } from "@/lib/verify/select";
import {
  VerifyError,
  isRateLimitError,
  mapUpstreamError,
} from "@/lib/verify/errors";
import type {
  Claim,
  Evidence,
  EvidenceVerification,
  SourceLink,
  VerifyEvidenceResponse,
} from "@/lib/types/debate";

export const VERIFY_GROUNDED_TIMEOUT_MS = 25_000;
export const VERIFY_STRUCTURED_TIMEOUT_MS = 15_000;

export type VerifyGenerateContentRequest = {
  model: string;
  contents: string;
  systemInstruction: string;
  /** When true, enable Google Search grounding (pass 1). */
  googleSearch?: boolean;
  /** When set, request structured JSON (pass 2). */
  responseJsonSchema?: unknown;
  timeoutMs: number;
};

export type VerifyGenerateContentResult = {
  text?: string;
  groundingMetadata?: unknown;
};

export type VerifyGenerateContentFn = (
  req: VerifyGenerateContentRequest,
) => Promise<VerifyGenerateContentResult>;

export function getVerifyModel(): string {
  return process.env.GEMINI_VERIFY_MODEL?.trim() || GEMINI_MODEL;
}

export function isVerifyEnabled(): boolean {
  const raw = process.env.ARGUS_VERIFY_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return raw !== "false" && raw !== "0" && raw !== "no" && raw !== "off";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterMs(): number {
  return 200 + Math.floor(Math.random() * 400);
}

async function withOneRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isRateLimitError(err)) throw mapUpstreamError(err);
    await sleep(jitterMs());
    try {
      return await fn();
    } catch (err2) {
      if (isRateLimitError(err2)) {
        throw new VerifyError(
          "Gemini rate limited after retry",
          "RATE_LIMIT",
          "RATE_LIMIT",
        );
      }
      throw mapUpstreamError(err2);
    }
  }
}

function extractGroundingMetadata(response: unknown): unknown {
  if (!response || typeof response !== "object") return undefined;
  const r = response as {
    candidates?: Array<{ groundingMetadata?: unknown }>;
    groundingMetadata?: unknown;
  };
  return (
    r.candidates?.[0]?.groundingMetadata ?? r.groundingMetadata ?? undefined
  );
}

/** Default GenAI adapter used by the route (tests inject mocks). */
export function createDefaultGenerateContent(): VerifyGenerateContentFn {
  return async (req) => {
    const ai = getGenAI();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs);
    try {
      const response = await ai.models.generateContent({
        model: req.model,
        contents: req.contents,
        config: {
          systemInstruction: req.systemInstruction,
          temperature: 0.2,
          abortSignal: controller.signal,
          ...(req.googleSearch
            ? { tools: [{ googleSearch: {} }] }
            : {
                responseMimeType: "application/json",
                responseJsonSchema: req.responseJsonSchema,
              }),
        },
      });
      return {
        text: response.text?.trim(),
        groundingMetadata: extractGroundingMetadata(response),
      };
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * Apply allowlist + corroboration invariants to model JSON.
 * Empty sources can never remain corroborated.
 */
export function finalizeModelVerification(
  model: ModelVerify,
  allowlist: SourceLink[],
  webSearchQueries: string[],
  now = Date.now(),
): EvidenceVerification {
  const sources = filterAllowlistedSources(model.sourceUris, allowlist);

  let status = model.status;
  if (status === "corroborated" && !canCorroborate(sources)) {
    status = "inconclusive";
  }
  if (sources.length === 0 && status === "corroborated") {
    status = "inconclusive";
  }

  // Empty allowlist after Search → inconclusive/not_verifiable only
  if (allowlist.length === 0 && status === "corroborated") {
    status = "inconclusive";
  }

  let summary = model.summary.trim();
  if (
    /true|false|incorrect|correct|right|wrong/i.test(summary) &&
    /\bclaim\b/i.test(summary)
  ) {
    // Soft sanitize — keep alignment language only
    summary = summary.replace(
      /\b(the )?claim is (true|false|correct|incorrect|right|wrong)\b/gi,
      "source alignment is mixed",
    );
  }

  return {
    status,
    relevance: model.relevance,
    ...(typeof model.confidence === "number"
      ? { confidence: model.confidence }
      : {}),
    summary,
    sources,
    ...(webSearchQueries.length > 0 ? { webSearchQueries } : {}),
    checkedAt: now,
  };
}

function emptyGroundingVerification(
  webSearchQueries: string[],
  groundedProse: string | undefined,
  now: number,
): EvidenceVerification {
  const looksSubjective =
    /\b(opinion|anecdote|cannot verify|not verifiable|subjective)\b/i.test(
      groundedProse ?? "",
    );
  return {
    status: looksSubjective ? "not_verifiable" : "inconclusive",
    relevance: "pending",
    confidence: 0.3,
    summary: looksSubjective
      ? "Search completed without grounded sources; Evidence appears not externally verifiable."
      : "Search completed without grounded web sources; corroboration is inconclusive.",
    sources: [],
    ...(webSearchQueries.length > 0 ? { webSearchQueries } : {}),
    checkedAt: now,
  };
}

export type RunVerifyOptions = {
  evidence: Evidence;
  claim: Claim;
  force?: boolean;
  now?: number;
  generateContent?: VerifyGenerateContentFn;
  model?: string;
};

/**
 * Run eligibility + optional two-pass verification.
 * Does not mutate the input Claim.
 */
export async function runVerifyEvidence(
  opts: RunVerifyOptions,
): Promise<VerifyEvidenceResponse> {
  const { evidence, claim } = opts;
  const now = opts.now ?? Date.now();

  // Defensive: never mutate claim
  const claimSnapshot = {
    speaker: claim.speaker,
    nature: claim.nature,
    text: claim.text,
  };

  const selected = selectEvidenceForVerify(evidence, {
    force: opts.force,
    now,
  });

  if (selected.action === "short_circuit" || selected.action === "skip") {
    const verification = selected.verification;
    return {
      evidenceId: evidence.id,
      verification,
      displayStatusHint: deriveClaimDisplayStatus(claim.id, [
        { ...evidence, verification },
      ]),
    };
  }

  const generateContent =
    opts.generateContent ?? createDefaultGenerateContent();
  const model = opts.model ?? getVerifyModel();

  const grounded = await withOneRateLimitRetry(() =>
    generateContent({
      model,
      contents: buildGroundedUserPrompt(evidence, claim),
      systemInstruction: VERIFY_GROUNDED_SYSTEM_PROMPT,
      googleSearch: true,
      timeoutMs: VERIFY_GROUNDED_TIMEOUT_MS,
    }),
  );

  const parsedGrounding = parseGroundingMetadata(grounded.groundingMetadata);
  const allowlist = parsedGrounding.sources;
  const queries = parsedGrounding.webSearchQueries;

  let verification: EvidenceVerification;

  if (!canCorroborate(allowlist)) {
    verification = emptyGroundingVerification(queries, grounded.text, now);
  } else {
    const structured = await withOneRateLimitRetry(() =>
      generateContent({
        model,
        contents: buildStructuredUserPrompt({
          groundedProse: grounded.text ?? "",
          allowlist,
          evidenceText: evidence.text,
          claimText: claim.text,
        }),
        systemInstruction: VERIFY_STRUCTURED_SYSTEM_PROMPT,
        responseJsonSchema: modelVerifyJsonSchema,
        timeoutMs: VERIFY_STRUCTURED_TIMEOUT_MS,
      }),
    );

    const rawText = structured.text?.trim();
    if (!rawText) {
      throw new VerifyError(
        "Empty structured verify response from Gemini",
        "PARSE",
        "PARSE",
      );
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawText);
    } catch {
      throw new VerifyError(
        "Structured verify response was not JSON",
        "PARSE",
        "PARSE",
      );
    }

    const modelParsed = modelVerifySchema.safeParse(rawJson);
    if (!modelParsed.success) {
      throw new VerifyError(
        `Structured verify JSON failed schema: ${modelParsed.error.issues
          .map((i) => i.message)
          .join("; ")}`,
        "PARSE",
        "PARSE",
      );
    }

    verification = finalizeModelVerification(
      modelParsed.data,
      allowlist,
      queries,
      now,
    );
  }

  // Claim must remain untouched
  if (
    claim.speaker !== claimSnapshot.speaker ||
    claim.nature !== claimSnapshot.nature ||
    claim.text !== claimSnapshot.text
  ) {
    throw new VerifyError(
      "Claim was mutated during verification",
      "UPSTREAM",
      "UPSTREAM",
    );
  }

  return {
    evidenceId: evidence.id,
    verification,
    displayStatusHint: deriveClaimDisplayStatus(claim.id, [
      { ...evidence, verification },
    ]),
  };
}
