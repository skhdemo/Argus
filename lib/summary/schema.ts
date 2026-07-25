import { z } from "zod";

import {
  claimSchema,
  evidenceSchema,
  relationSchema,
} from "@/lib/extract/schema";
import type { SummaryResponse } from "@/lib/types/debate";

export const summaryRequestSchema = z.object({
  claims: z.array(claimSchema).default([]),
  evidence: z.array(evidenceSchema).default([]),
  relations: z.array(relationSchema).default([]),
});

/** Model may return narrative + contested id; counts are computed server-side. */
export const modelSummarySchema = z.object({
  mostContestedClaimId: z.string().nullable().default(null),
  narrative: z.string().min(1),
  /** Optional; ignored in favor of server counts when present */
  claimCount: z.number().int().nonnegative().optional(),
  evidenceCount: z.number().int().nonnegative().optional(),
  unsupportedCount: z.number().int().nonnegative().optional(),
});

export type ModelSummary = z.infer<typeof modelSummarySchema>;
export type ParsedSummaryRequest = z.infer<typeof summaryRequestSchema>;

export const modelSummaryJsonSchema = {
  type: "object",
  properties: {
    mostContestedClaimId: { type: ["string", "null"] },
    narrative: { type: "string" },
    claimCount: { type: "number" },
    evidenceCount: { type: "number" },
    unsupportedCount: { type: "number" },
  },
  required: ["mostContestedClaimId", "narrative"],
} as const;

export function assertSummaryResponse(value: SummaryResponse): SummaryResponse {
  return value;
}
