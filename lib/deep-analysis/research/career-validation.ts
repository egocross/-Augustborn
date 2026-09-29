import 'server-only';

import { z } from 'zod';

import type { CareerResearchContext } from '../career-pipeline';
import { MarketEvidenceSchema, type MarketEvidence } from '../types';
import { searchCareerValidationMarket } from './jobs';

const CareerValidationSearchResultSchema = z.object({
  checkedAt: z.string().datetime(),
  queries: z.array(z.string().min(1).max(200)).min(1).max(4),
  evidence: z.array(MarketEvidenceSchema).max(24),
  failure: z.enum(['timeout', 'unavailable', 'no_sources']).optional(),
});

export type CareerValidationSearchResult = z.infer<typeof CareerValidationSearchResultSchema>;

export const CareerValidationResearchSchema = CareerValidationSearchResultSchema.extend({
  careerName: z.string().min(2).max(80),
  status: z.enum(['verified', 'partial', 'unavailable']),
  confidence: z.enum(['high', 'medium', 'low']),
  note: z.string().min(1).max(600),
  cacheStatus: z.enum(['hit', 'miss']),
});
export type CareerValidationResearch = z.infer<typeof CareerValidationResearchSchema>;

const CREDENTIAL_ROLE_PATTERN = /(医生|医师|护士|药师|律师|教师|会计师|注册会计|建筑师|建造师|电工|焊工|特种作业|消防设施|心理治疗|证券从业|基金从业)/;

function normalizeCareerName(value: string): string {
  const firstLine = value.normalize('NFKC').split(/[\r\n]/, 1)[0] ?? '';
  const safe = firstLine.replace(/[<>"'`{}\[\]\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  return safe.length >= 2 ? safe : '目标岗位';
}

export function createCareerValidationQueries(
  careerName: string,
  _context: CareerResearchContext,
  date: string,
): string[] {
  const career = normalizeCareerName(careerName);
  const year = /^\d{4}/.exec(date)?.[0] ?? String(new Date().getUTCFullYear());
  const queries = [
    `${career} 招聘 任职要求 中国 ${year}`,
    `${career} 岗位职责 JD 中国`,
  ];
  if (CREDENTIAL_ROLE_PATTERN.test(career)) queries.push(`${career} 职业资格 官方 中国`);
  return queries;
}

type ResearchOptions = { signal?: AbortSignal };
type Search = (
  careerName: string,
  queries: string[],
  options?: ResearchOptions,
) => Promise<CareerValidationSearchResult>;

function deduplicateEvidence(evidence: MarketEvidence[]): MarketEvidence[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.url ?? item.title}\n${item.fact}`.normalize('NFKC').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

export function createCareerValidationResearchService(config: {
  search: Search;
  now?: () => number;
  ttlMs?: number;
}) {
  const now = config.now ?? Date.now;
  const ttlMs = config.ttlMs ?? 6 * 60 * 60 * 1000;
  const cache = new Map<string, { expiresAt: number; value: CareerValidationResearch }>();

  return async (
    careerName: string,
    context: CareerResearchContext,
    options: ResearchOptions = {},
  ): Promise<CareerValidationResearch> => {
    const safeCareerName = normalizeCareerName(careerName);
    const cacheKey = JSON.stringify({
      career: safeCareerName,
      region: context.regionScope,
      income: context.incomeBand,
      employment: [...context.employmentTypes].sort(),
    });
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now()) {
      return CareerValidationResearchSchema.parse({ ...cached.value, cacheStatus: 'hit' });
    }

    const date = new Date(now()).toISOString().slice(0, 10);
    const queries = createCareerValidationQueries(safeCareerName, context, date);
    let searched: CareerValidationSearchResult;
    try {
      searched = CareerValidationSearchResultSchema.parse(
        await config.search(safeCareerName, queries, options),
      );
    } catch {
      options.signal?.throwIfAborted();
      searched = {
        checkedAt: new Date(now()).toISOString(),
        queries,
        evidence: [],
        failure: 'unavailable',
      };
    }
    const evidence = deduplicateEvidence(searched.evidence);
    const status = evidence.length >= 3 ? 'verified' : evidence.length ? 'partial' : 'unavailable';
    const value = CareerValidationResearchSchema.parse({
      ...searched,
      careerName: safeCareerName,
      evidence,
      status,
      confidence: evidence.length >= 4 ? 'high' : evidence.length >= 2 ? 'medium' : 'low',
      note: evidence.length
        ? '以下市场事实来自公开来源；综合判断会与事实分开呈现。'
        : '当前公开信息不足，建议把“真实岗位访谈 / JD 核实”作为第一验证动作。',
      cacheStatus: 'miss',
    });
    cache.set(cacheKey, { expiresAt: now() + ttlMs, value });
    return value;
  };
}

export const researchCareerValidation = createCareerValidationResearchService({
  search: searchCareerValidationMarket,
});
