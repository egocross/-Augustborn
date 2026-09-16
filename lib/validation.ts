import { z } from 'zod';

export const analysisSchema = z
  .object({
    lunarYear: z.number().int().min(1900).max(2100),
    lunarMonth: z.number().int().min(1).max(12),
    lunarDay: z.number().int().min(1).max(30),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  })
  .strict();

export const feedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    wantsDeepAnalysis: z.boolean(),
  })
  .strict();
