import { z } from "zod";

import {
  claimSchema,
  evidenceSchema,
  evidenceRelevanceSchema,
} from "@/lib/extract/schema";

/** Model statuses for the structured verify pass (pending/error are server-side). */
export const modelVerifyStatusSchema = z.enum([
  "corroborated",
  "contested",
  "inconclusive",
  "not_verifiable",
]);

export const modelVerifySchema = z.object({
  status: modelVerifyStatusSchema,
  relevance: evidenceRelevanceSchema,
  confidence: z.number().min(0).max(1).optional(),
  summary: z.string().min(1),
  sourceUris: z.array(z.string()).default([]),
});

export type ModelVerify = z.infer<typeof modelVerifySchema>;

export const modelVerifyJsonSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["corroborated", "contested", "inconclusive", "not_verifiable"],
    },
    relevance: {
      type: "string",
      enum: ["pending", "strong", "moderate", "weak", "irrelevant"],
    },
    confidence: { type: "number" },
    summary: { type: "string" },
    sourceUris: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["status", "relevance", "summary", "sourceUris"],
  additionalProperties: false,
} as const;

export const verifyEvidenceRequestSchema = z.object({
  evidence: evidenceSchema,
  claim: claimSchema,
  force: z.boolean().optional(),
});

export type ParsedVerifyEvidenceRequest = z.infer<
  typeof verifyEvidenceRequestSchema
>;
