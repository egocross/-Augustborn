import { z } from 'zod';

export const MarketDirectionSchema = z.enum(['industry', 'city']);
export type MarketDirection = z.infer<typeof MarketDirectionSchema>;
export const MarketAdviceSchema = z.object({
  name: z.string().min(2).max(60),
  evidenceIds: z.array(z.string().min(1).max(80)).min(1).max(3),
  priority: z.number().int().min(1).max(3),
  fitReason: z.string().min(1).max(700),
  boundary: z.string().min(1).max(500),
  nextStep: z.string().min(1).max(500),
});
const sourceSchema = z.object({
  title: z.string().min(1).max(300),
  url: z.string().url().max(4000).refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }),
  site: z.string().min(1).max(100),
  excerpt: z.string().min(1).max(2200),
});
export const MarketResearchSchema = z.object({
  direction: MarketDirectionSchema,
  status: z.enum(['sourced', 'unavailable', 'sample']),
  checkedAt: z.string().datetime(),
  note: z.string().min(1).max(600),
  examples: z.array(MarketAdviceSchema.omit({ evidenceIds: true }).extend({ sources: z.array(sourceSchema).min(1).max(3) })).max(9),
  searchSuggestionsHtml: z.string().max(50_000).optional(),
});
export type MarketResearch = z.infer<typeof MarketResearchSchema>;
export type MarketEvidence = {
  direction: MarketDirection;
  checkedAt: string;
  evidence: Array<{ id: string; source: z.infer<typeof sourceSchema> }>;
  searchSuggestionsHtml?: string;
  failure?: 'timeout' | 'unavailable' | 'no_sources';
};
