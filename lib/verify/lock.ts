/**
 * In-process concurrency guard for /api/verify-evidence.
 *
 * Serverless instances cannot share a global lock — FE must also serialize
 * verification requests globally (concurrency one).
 */

import { VerifyError } from "@/lib/verify/errors";

let active = 0;

export function getVerifyConcurrencyLimit(): number {
  const raw = process.env.ARGUS_VERIFY_CONCURRENCY?.trim();
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function getVerifyActiveCount(): number {
  return active;
}

/** Test helper — reset in-process lock state. */
export function resetVerifyLockForTests(): void {
  active = 0;
}

export async function withVerifyLock<T>(fn: () => Promise<T>): Promise<T> {
  const limit = getVerifyConcurrencyLimit();
  if (active >= limit) {
    throw new VerifyError(
      "Verification busy (in-process concurrency limit). Retry shortly.",
      "RATE_LIMIT",
      "RATE_LIMIT",
    );
  }
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
  }
}
