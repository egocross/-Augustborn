import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContentStream, GoogleGenAI, researchCareerMarket } = vi.hoisted(() => {
  const generateContentStream = vi.fn();
  const GoogleGenAI = vi.fn(function GoogleGenAI() {
    return { models: { generateContentStream } };
  });
  return { generateContentStream, GoogleGenAI, researchCareerMarket: vi.fn() };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI,
  ThinkingLevel: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));
vi.mock('./research/jobs', () => ({ researchCareerMarket }));

import { createSampleCareerReport } from '@/lib/report-provider/sample';
import { generateCareerReportStream } from './gemini';
import type { CareerGenerationRequest } from './career-pipeline';

const request: CareerGenerationRequest = {
  questionnaireVersion: 'career-v1',
  baseReport: { disclaimer: '仅供参考', sections: [{ heading: '方向', body: '偏好清晰交付', bullets: [] }] },
  careerCalibration: {
    questionnaireVersion: 'career-v1',
    hardConstraints: {
      careerStatus: 'career_status_first_job', transitionUrgency: 'transition_3_months',
      income: { minimumIncomeBand: 'minimum_income_3000_5000', currency: 'CNY', salaryDropTolerance: 'salary_drop_none' },
      responsibilities: ['responsibility_none'], location: { mobility: 'mobility_nationwide', constraints: [] },
      transitionCapacity: { weeklyHours: 'weekly_hours_full_time', preparationHorizon: 'preparation_3_6_months', maxBudget: 'budget_none' },
      restartTolerance: 'restart_entry_level', educationTolerance: 'education_short',
      workConstraints: ['work_constraint_none'], incomeModels: ['income_model_any'], employmentTypes: ['employment_type_any'],
    },
    careerCapital: { experience: [], skills: ['capital_content'], evidence: [] }, values: ['value_growth'],
  },
};

const source = {
  evidenceId: 'job_source_1', title: '内容策划招聘', site: '猎聘',
  url: 'https://www.liepin.com/job/123456789.shtml', excerpt: '“内容策划”职位详情',
};

beforeEach(() => {
  generateContentStream.mockReset();
  GoogleGenAI.mockClear();
  researchCareerMarket.mockReset();
});

describe('career Gemini adapter', () => {
  it('researches after payment-owned invocation and keeps only server-verified sources', async () => {
    researchCareerMarket.mockResolvedValue({
      status: 'partial', retrievedAt: '2026-09-29T08:00:00.000Z', sources: [source], note: '少量来源',
    });
    const modelReport = createSampleCareerReport(request);
    modelReport.marketStatus = 'verified';
    modelReport.careerHypotheses[0] = {
      ...modelReport.careerHypotheses[0],
      sources: [source, { ...source, url: 'https://evil.example/fake' }],
      sourceCount: 2,
      evidenceStatus: 'verified',
    };
    generateContentStream.mockImplementation(async function* () {
      yield { text: JSON.stringify(modelReport) };
    });
    const stages: string[] = [];
    const stream = generateCareerReportStream(request, { onStage: (stage) => stages.push(stage) });
    await stream.next();
    const result = await stream.next();
    expect(result.done).toBe(true);
    if (!result.done || !result.value || !('kind' in result.value)) throw new Error('missing report');
    expect(stages).toEqual(['researching', 'converging']);
    expect(result.value.marketStatus).toBe('partial');
    expect(result.value.careerHypotheses[0].sources).toEqual([{ title: source.title, site: source.site, url: source.url, excerpt: source.excerpt }]);
    expect(result.value.careerHypotheses[0]).toMatchObject({ evidenceStatus: 'partial', sourceCount: 1 });
  });

  it('degrades cleanly when research is unavailable and never preserves invented sources', async () => {
    researchCareerMarket.mockResolvedValue({
      status: 'unavailable', retrievedAt: '2026-09-29T08:00:00.000Z', sources: [], note: '检索不可用',
    });
    const modelReport = createSampleCareerReport(request);
    modelReport.marketStatus = 'verified';
    modelReport.careerHypotheses[0] = {
      ...modelReport.careerHypotheses[0], sources: [{ ...source, url: 'https://evil.example/fake' }],
      sourceCount: 1, evidenceStatus: 'verified',
    };
    generateContentStream.mockImplementation(async function* () { yield { text: JSON.stringify(modelReport) }; });
    const stream = generateCareerReportStream(request);
    await stream.next();
    const result = await stream.next();
    if (!result.done || !result.value || !('kind' in result.value)) throw new Error('missing report');
    expect(result.value.marketStatus).toBe('unavailable');
    expect(result.value.careerHypotheses.every((item) => item.sources.length === 0)).toBe(true);
    expect(result.value.careerHypotheses[0].marketEvidenceSummary).toContain('待验证');
  });

  it('maps invalid model JSON to parse_failed', async () => {
    researchCareerMarket.mockResolvedValue({
      status: 'unavailable', retrievedAt: null, sources: [], note: '检索不可用',
    });
    generateContentStream.mockImplementation(async function* () { yield { text: '{bad' }; });
    const stream = generateCareerReportStream(request);
    await stream.next();
    await expect(stream.next()).rejects.toMatchObject({ code: 'parse_failed' });
  });
});
