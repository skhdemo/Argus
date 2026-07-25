/**
 * Typed errors for Evidence verification (mapped to ApiErrorBody codes).
 */

import type { ApiErrorBody, VerifyErrorCode } from "@/lib/types/debate";

export type VerifyHttpCode = ApiErrorBody["code"];

export class VerifyError extends Error {
  readonly code: VerifyHttpCode;
  readonly verifyErrorCode?: VerifyErrorCode;

  constructor(
    message: string,
    code: VerifyHttpCode,
    verifyErrorCode?: VerifyErrorCode,
  ) {
    super(message);
    this.name = "VerifyError";
    this.code = code;
    this.verifyErrorCode = verifyErrorCode;
  }
}

export function isRateLimitError(err: unknown): boolean {
  if (err instanceof VerifyError && err.code === "RATE_LIMIT") return true;
  const message = err instanceof Error ? err.message : String(err);
  const status =
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : undefined;
  return (
    status === 429 ||
    /\b429\b/.test(message) ||
    /rate.?limit/i.test(message) ||
    /quota/i.test(message) ||
    /RESOURCE_EXHAUSTED/i.test(message)
  );
}

export function isTimeoutError(err: unknown): boolean {
  if (err instanceof VerifyError && err.code === "TIMEOUT") return true;
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  return (
    name === "AbortError" ||
    /timeout/i.test(message) ||
    /timed out/i.test(message) ||
    /TimeoutError/i.test(message)
  );
}

export function isBlockedError(err: unknown): boolean {
  if (err instanceof VerifyError && err.code === "BLOCKED") return true;
  const message = err instanceof Error ? err.message : String(err);
  return (
    /safety|blocked|SAFETY|BLOCKLIST|prohibited/i.test(message) ||
    /PROMPT_BLOCKED|finishReason.*SAFETY/i.test(message)
  );
}

export function mapUpstreamError(err: unknown): VerifyError {
  if (err instanceof VerifyError) return err;
  if (isTimeoutError(err)) {
    return new VerifyError(
      err instanceof Error ? err.message : "Verification timed out",
      "TIMEOUT",
      "TIMEOUT",
    );
  }
  if (isRateLimitError(err)) {
    return new VerifyError(
      err instanceof Error ? err.message : "Rate limited",
      "RATE_LIMIT",
      "RATE_LIMIT",
    );
  }
  if (isBlockedError(err)) {
    return new VerifyError(
      err instanceof Error ? err.message : "Blocked by safety filters",
      "BLOCKED",
      "BLOCKED",
    );
  }
  return new VerifyError(
    err instanceof Error ? err.message : "Upstream Gemini error",
    "UPSTREAM",
    "UPSTREAM",
  );
}
