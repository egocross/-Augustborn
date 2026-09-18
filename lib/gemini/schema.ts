import { z } from 'zod';

export const ReportSchema = z.object({
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        body: z.string().min(1),
        bullets: z.array(z.string()),
      }),
    )
    .min(1),
  disclaimer: z.string().min(1),
});

export type Report = z.infer<typeof ReportSchema>;

/** JSON Schema supplied to Gemini for structured, model-sized responses. */
export const ReportJsonSchema = z.toJSONSchema(ReportSchema);

export const parseReport = (value: unknown): Report => ReportSchema.parse(value);
