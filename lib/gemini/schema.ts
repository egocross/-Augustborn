import { z } from 'zod';

export const ReportSectionSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
  bullets: z.array(z.string()),
});

export const ReportSchema = z.object({
  sections: z.array(ReportSectionSchema).min(1),
  disclaimer: z.string().min(1),
});

export type ReportSection = z.infer<typeof ReportSectionSchema>;

export type Report = z.infer<typeof ReportSchema>;

export const parseReport = (value: unknown): Report => ReportSchema.parse(value);
