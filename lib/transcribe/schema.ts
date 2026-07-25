import { z } from "zod";

export const speakerIdSchema = z.enum(["A", "B", "UNKNOWN"]);

export const transcriptSegmentSchema = z.object({
  speaker: speakerIdSchema,
  text: z.string().min(1),
  timestamp: z.string().optional(),
});

export const modelTranscribeSchema = z.object({
  segments: z.array(transcriptSegmentSchema).default([]),
  inferredSpeaker: speakerIdSchema.default("UNKNOWN"),
  speakerConfidence: z.number().min(0).max(1).default(0.5),
  notes: z.string().optional(),
});

export type ModelTranscribe = z.infer<typeof modelTranscribeSchema>;

export const modelTranscribeJsonSchema = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          speaker: { type: "string", enum: ["A", "B", "UNKNOWN"] },
          text: { type: "string" },
          timestamp: { type: "string" },
        },
        required: ["speaker", "text"],
      },
    },
    inferredSpeaker: { type: "string", enum: ["A", "B", "UNKNOWN"] },
    speakerConfidence: { type: "number" },
    notes: { type: "string" },
  },
  required: ["segments", "inferredSpeaker", "speakerConfidence"],
} as const;
