import { z } from 'zod';

const httpsUrl = z.string().url().max(4000).refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
});

export const JobAdviceSchema = z.object({
  evidenceId: z.string().min(1).max(80),
  title: z.string().min(2).max(80),
  searchKeywords: z.array(z.string().min(2).max(80)).min(1).max(4),
  fitReason: z.string().min(1).max(800),
  entryGap: z.string().min(1).max(800),
  nextStep: z.string().min(1).max(600),
});

export const JobResearchSchema = z.object({
  status: z.enum(['matched', 'limited', 'unavailable', 'sample']),
  checkedAt: z.string().datetime(),
  note: z.string().min(1).max(600),
  recommendations: z.array(JobAdviceSchema.omit({ evidenceId: true }).extend({
    source: z.object({
      title: z.string().min(1).max(300),
      url: httpsUrl,
      site: z.string().min(1).max(80),
      excerpt: z.string().min(1).max(1800),
    }),
  })).max(5),
  searchSuggestionsHtml: z.string().max(50_000).optional(),
});

export type JobResearch = z.infer<typeof JobResearchSchema>;
export type JobEvidence = { id: string; source: JobResearch['recommendations'][number]['source'] };
export type WorkResearch = {
  checkedAt: string;
  evidence: JobEvidence[];
  searchSuggestionsHtml?: string;
  failure?: 'timeout' | 'unavailable' | 'no_sources';
};
