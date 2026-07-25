import { z } from "zod";

/**
 * Public + model schemas for claim–evidence v2.
 * Inferred types below mirror the canonical contract in lib/types/debate.ts
 * (parent may still be landing that file — these schemas are the extract source of truth).
 */

export const speakerIdSchema = z.enum(["A", "B", "UNKNOWN"]);

export const claimNatureSchema = z.enum(["argument", "counterargument"]);

export const relationTypeSchema = z.enum(["counters", "responds_to"]);

export const evidenceKindSchema = z.enum([
  "statistic",
  "citation",
  "factual_claim",
  "example",
  "anecdote",
  "reasoning",
  "authority",
]);

export const fallacyTagSchema = z.enum([
  "ad_hominem",
  "strawman",
  "circular_reasoning",
  "false_dilemma",
]);

export const evidenceVerificationStatusSchema = z.enum([
  "pending",
  "corroborated",
  "contested",
  "inconclusive",
  "not_verifiable",
  "error",
]);

export const evidenceRelevanceSchema = z.enum([
  "pending",
  "strong",
  "moderate",
  "weak",
  "irrelevant",
]);

export const verifyErrorCodeSchema = z.enum([
  "RATE_LIMIT",
  "TIMEOUT",
  "BLOCKED",
  "PARSE",
  "UPSTREAM",
  "VERIFY_DISABLED",
  "MISSING_KEY",
]);

export const sourceLinkSchema = z.object({
  uri: z.string().min(1),
  title: z.string().optional(),
  domain: z.string().optional(),
});

export const evidenceVerificationSchema = z.object({
  status: evidenceVerificationStatusSchema,
  relevance: evidenceRelevanceSchema,
  confidence: z.number().min(0).max(1).optional(),
  summary: z.string().optional(),
  sources: z.array(sourceLinkSchema).default([]),
  webSearchQueries: z.array(z.string()).optional(),
  checkedAt: z.number().optional(),
  errorCode: verifyErrorCodeSchema.optional(),
});

export const claimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  speaker: speakerIdSchema,
  speakerConfidence: z.number().min(0).max(1).optional(),
  nature: claimNatureSchema,
  fallacies: z.array(fallacyTagSchema).optional(),
  sourceExcerpt: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
});

export const evidenceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  speaker: speakerIdSchema,
  supportsClaimIds: z.array(z.string().min(1)).min(1),
  kind: evidenceKindSchema,
  sourceExcerpt: z.string().optional(),
  verification: evidenceVerificationSchema,
  createdAt: z.number(),
  updatedAt: z.number().optional(),
});

export const relationSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  type: relationTypeSchema,
});

export const extractRequestSchema = z.object({
  text: z.string().min(1, "text is required"),
  transcriptWindow: z.string().optional(),
  inferredSpeaker: speakerIdSchema.nullable().optional(),
  pauseMs: z.number().finite().optional(),
  existingClaims: z.array(claimSchema).default([]),
  existingEvidence: z.array(evidenceSchema).default([]),
  existingRelations: z.array(relationSchema).default([]),
});

export const extractResponseSchema = z.object({
  claims: z.array(claimSchema),
  evidence: z.array(evidenceSchema),
  relations: z.array(relationSchema),
  inferredSpeaker: speakerIdSchema,
  speakerConfidence: z.number().min(0).max(1),
  notes: z.string().optional(),
});

/** Raw model claim before stable id assignment */
export const modelClaimSchema = z
  .object({
    clientId: z.string().min(1),
    updateClaimId: z.string().min(1).optional(),
    text: z.string().min(1),
    speaker: speakerIdSchema,
    nature: claimNatureSchema,
    sourceExcerpt: z.string().optional(),
    fallacies: z.array(fallacyTagSchema).optional(),
  })
  .strict();

/** Raw model evidence — targets must be non-empty (orphan evidence rejected here) */
export const modelEvidenceSchema = z
  .object({
    clientId: z.string().min(1),
    updateEvidenceId: z.string().min(1).optional(),
    text: z.string().min(1),
    speaker: speakerIdSchema,
    kind: evidenceKindSchema,
    targetClaimRefs: z.array(z.string().min(1)).min(1),
    sourceExcerpt: z.string().optional(),
  })
  .strict();

export const modelRelationSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    type: relationTypeSchema,
  })
  .strict();

export const modelExtractSchema = z.object({
  claims: z.array(modelClaimSchema).default([]),
  evidence: z.array(modelEvidenceSchema).default([]),
  relations: z.array(modelRelationSchema).default([]),
  inferredSpeaker: speakerIdSchema.default("UNKNOWN"),
  speakerConfidence: z.number().min(0).max(1).default(0.5),
  notes: z.string().optional(),
});

export type SpeakerId = z.infer<typeof speakerIdSchema>;
export type ClaimNature = z.infer<typeof claimNatureSchema>;
export type RelationType = z.infer<typeof relationTypeSchema>;
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type FallacyTag = z.infer<typeof fallacyTagSchema>;
export type EvidenceVerificationStatus = z.infer<
  typeof evidenceVerificationStatusSchema
>;
export type EvidenceRelevance = z.infer<typeof evidenceRelevanceSchema>;
export type VerifyErrorCode = z.infer<typeof verifyErrorCodeSchema>;
export type SourceLink = z.infer<typeof sourceLinkSchema>;
export type EvidenceVerification = z.infer<typeof evidenceVerificationSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type ExtractRequest = z.infer<typeof extractRequestSchema>;
export type ExtractResponse = z.infer<typeof extractResponseSchema>;
export type ModelClaim = z.infer<typeof modelClaimSchema>;
export type ModelEvidence = z.infer<typeof modelEvidenceSchema>;
export type ModelRelation = z.infer<typeof modelRelationSchema>;
export type ModelExtract = z.infer<typeof modelExtractSchema>;
export type ParsedExtractRequest = ExtractRequest;

export type ApiErrorBody = {
  error: string;
  code:
    | "BAD_REQUEST"
    | "MISSING_KEY"
    | "UPSTREAM"
    | "PARSE"
    | "RATE_LIMIT"
    | "TIMEOUT"
    | "BLOCKED"
    | "VERIFY_DISABLED";
};

/**
 * @deprecated Use `relationSchema`. Temporary alias so score/summary keep
 * resolving until their v2 rewrites land. Does not accept legacy `supports`.
 */
export const edgeSchema = relationSchema;

/**
 * JSON Schema for Gemini responseJsonSchema.
 * Keep in sync with modelExtractSchema — no verification / support status fields.
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
          updateClaimId: { type: "string" },
          text: { type: "string" },
          speaker: { type: "string", enum: ["A", "B", "UNKNOWN"] },
          nature: {
            type: "string",
            enum: ["argument", "counterargument"],
          },
          sourceExcerpt: { type: "string" },
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
        required: ["clientId", "text", "speaker", "nature"],
        additionalProperties: false,
      },
    },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          updateEvidenceId: { type: "string" },
          text: { type: "string" },
          speaker: { type: "string", enum: ["A", "B", "UNKNOWN"] },
          kind: {
            type: "string",
            enum: [
              "statistic",
              "citation",
              "factual_claim",
              "example",
              "anecdote",
              "reasoning",
              "authority",
            ],
          },
          targetClaimRefs: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          sourceExcerpt: { type: "string" },
        },
        required: ["clientId", "text", "speaker", "kind", "targetClaimRefs"],
        additionalProperties: false,
      },
    },
    relations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          type: {
            type: "string",
            enum: ["counters", "responds_to"],
          },
        },
        required: ["from", "to", "type"],
        additionalProperties: false,
      },
    },
    inferredSpeaker: { type: "string", enum: ["A", "B", "UNKNOWN"] },
    speakerConfidence: { type: "number" },
    notes: { type: "string" },
  },
  required: [
    "claims",
    "evidence",
    "relations",
    "inferredSpeaker",
    "speakerConfidence",
  ],
} as const;

export function assertExtractResponse(
  value: ExtractResponse,
): ExtractResponse {
  return extractResponseSchema.parse(value);
}
