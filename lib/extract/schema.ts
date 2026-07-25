import { z } from "zod";

import type { ExtractResponse } from "@/lib/types/debate";

export const speakerIdSchema = z.enum(["A", "B", "UNKNOWN"]);

export const claimTypeSchema = z.enum([
  "supported",
  "assumption",
  "needs_evidence",
  "counterargument",
]);

export const edgeTypeSchema = z.enum([
  "supports",
  "contradicts",
  "responds_to",
]);

export const claimSchema = z.object({
  id: z.string(),
  text: z.string(),
  speaker: speakerIdSchema,
  speakerConfidence: z.number().min(0).max(1).optional(),
  type: claimTypeSchema,
  unsupported: z.boolean().optional(),
  fallacies: z
    .array(
      z.enum([
        "ad_hominem",
        "strawman",
        "circular_reasoning",
        "false_dilemma",
      ]),
    )
    .optional(),
  sourceExcerpt: z.string().optional(),
  createdAt: z.number(),
});

export const edgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  type: edgeTypeSchema,
});

export const extractRequestSchema = z.object({
  text: z.string().min(1, "text is required"),
  transcriptWindow: z.string().optional(),
  inferredSpeaker: speakerIdSchema.nullable().optional(),
  existingClaims: z.array(claimSchema).default([]),
  existingEdges: z.array(edgeSchema).default([]),
});

export const fallacyTagSchema = z.enum([
  "ad_hominem",
  "strawman",
  "circular_reasoning",
  "false_dilemma",
]);

/** Raw model JSON before stable id assignment */
export const modelClaimSchema = z.object({
  clientId: z.string().min(1),
  text: z.string().min(1),
  speaker: speakerIdSchema,
  type: claimTypeSchema,
  sourceExcerpt: z.string().optional(),
  /** Soft warning from BE2 fallacy instructions — not a truth verdict */
  unsupported: z.boolean().optional(),
  fallacies: z.array(fallacyTagSchema).optional(),
});

export const modelEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: edgeTypeSchema,
});

export const modelExtractSchema = z.object({
  claims: z.array(modelClaimSchema).default([]),
  edges: z.array(modelEdgeSchema).default([]),
  inferredSpeaker: speakerIdSchema.default("UNKNOWN"),
  speakerConfidence: z.number().min(0).max(1).default(0.5),
  notes: z.string().optional(),
});

export type ModelExtract = z.infer<typeof modelExtractSchema>;
export type ParsedExtractRequest = z.infer<typeof extractRequestSchema>;

/**
 * JSON Schema for Gemini responseJsonSchema (subset of JSON Schema).
 * Keep in sync with modelExtractSchema.
 */
export const modelExtractJsonSchema = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          text: { type: "string" },
          speaker: { type: "string", enum: ["A", "B", "UNKNOWN"] },
          type: {
            type: "string",
            enum: [
              "supported",
              "assumption",
              "needs_evidence",
              "counterargument",
            ],
          },
          sourceExcerpt: { type: "string" },
          unsupported: { type: "boolean" },
          fallacies: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "ad_hominem",
                "strawman",
                "circular_reasoning",
                "false_dilemma",
              ],
            },
          },
        },
        required: ["clientId", "text", "speaker", "type"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          type: {
            type: "string",
            enum: ["supports", "contradicts", "responds_to"],
          },
        },
        required: ["from", "to", "type"],
      },
    },
    inferredSpeaker: { type: "string", enum: ["A", "B", "UNKNOWN"] },
    speakerConfidence: { type: "number" },
    notes: { type: "string" },
  },
  required: ["claims", "edges", "inferredSpeaker", "speakerConfidence"],
} as const;

export function assertExtractResponse(
  value: ExtractResponse,
): ExtractResponse {
  return value;
}
