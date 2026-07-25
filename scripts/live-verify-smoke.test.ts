/**
 * Opt-in live smoke for /api/verify-evidence (Gemini + Google Search).
 *
 * Run only with a real key:
 *   ARGUS_LIVE_VERIFY=1 GEMINI_API_KEY=... npm run test:live:verify
 *
 * Skips by default so CI / `npm test` never hit live Search.
 */

import { describe, expect, it } from "vitest";

import { runVerifyEvidence } from "@/lib/verify/runVerify";
import type { Claim, Evidence } from "@/lib/types/debate";

const live = process.env.ARGUS_LIVE_VERIFY === "1";

describe.skipIf(!live)("live verify smoke (opt-in)", () => {
  it(
    "verifies a searchable factual claim without throwing",
    async () => {
      expect(process.env.GEMINI_API_KEY?.trim()).toBeTruthy();

      const claim: Claim = {
        id: "c_live_smoke",
        text: "Lionel Messi has won the FIFA World Cup.",
        speaker: "A",
        nature: "argument",
        createdAt: Date.now(),
      };

      const evidence: Evidence = {
        id: "ev_live_smoke",
        text: "Messi won the 2022 FIFA World Cup with Argentina.",
        speaker: "A",
        supportsClaimIds: [claim.id],
        kind: "factual_claim",
        verification: {
          status: "pending",
          relevance: "pending",
          sources: [],
        },
        createdAt: Date.now(),
      };

      const result = await runVerifyEvidence({ evidence, claim, force: true });

      console.info("[live-verify-smoke]", {
        evidenceId: result.evidenceId,
        status: result.verification.status,
        relevance: result.verification.relevance,
        sourceCount: result.verification.sources.length,
      });

      expect(result.evidenceId).toBe(evidence.id);
      expect([
        "corroborated",
        "contested",
        "inconclusive",
        "not_verifiable",
        "error",
      ]).toContain(result.verification.status);

      // Model memory alone must never invent corroborated without sources.
      if (result.verification.status === "corroborated") {
        expect(result.verification.sources.length).toBeGreaterThan(0);
      }
    },
    90_000,
  );
});
