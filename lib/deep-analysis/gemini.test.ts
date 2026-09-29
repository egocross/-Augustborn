import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent, generateContentStream, GoogleGenAI, researchCareerMarket, researchCareerValidation } = vi.hoisted(() => {
  const generateContent = vi.fn();
  const generateContentStream = vi.fn();
  const GoogleGenAI = vi.fn(function GoogleGenAI() {
    return { models: { generateContent, generateContentStream } };
  });
  return {
    generateContent,
    generateContentStream,
    GoogleGenAI,
    researchCareerMarket: vi.fn(),
    researchCareerValidation: vi.fn(),
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI,
  ThinkingLevel: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));
vi.mock('./research/jobs', () => ({ researchCareerMarket }));
vi.mock('./research/career-validation', () => ({ researchCareerValidation }));

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
  generateContent.mockReset();
  generateContentStream.mockReset();
  GoogleGenAI.mockClear();
  researchCareerMarket.mockReset();
  researchCareerValidation.mockReset();
  researchCareerValidation.mockImplementation(async (careerName: string) => ({
    careerName,
    checkedAt: '2026-09-30T08:00:00.000Z',
    queries: [`${careerName} 岗位职责 JD 中国`],
    evidence: [],
    status: 'unavailable',
    confidence: 'low',
    note: '当前公开信息不足',
    cacheStatus: 'miss',
  }));
  generateContent.mockImplementation(async ({ contents }: { contents: string }) => {
    const title = ['内容策划', '产品运营', '用户研究助理'].find((value) => contents.includes(value)) ?? '目标岗位';
    const validation = createSampleCareerReport(request).careerHypotheses
      .find((item) => item.title === title)?.workValidation;
    return { text: JSON.stringify(validation) };
  });
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
    expect(stages).toEqual(['market_research', 'candidate_analysis', 'work_reality', 'capability_signals', 'validation_paths']);
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

  it('validates careers independently, strips invented evidence, and keeps going after one career fails', async () => {
    researchCareerMarket.mockResolvedValue({
      status: 'unavailable', retrievedAt: null, sources: [], note: '候选阶段没有市场来源',
    });
    const trustedEvidence = {
      sourceType: 'job_posting' as const, title: '内容策划招聘', source: '猎聘',
      url: 'https://www.liepin.com/job/123456789.shtml',
      fact: '岗位需要内容策划与跨团队协作。',
    };
    researchCareerValidation.mockImplementation(async (careerName: string) => ({
      careerName,
      checkedAt: '2026-09-30T08:00:00.000Z',
      queries: [`${careerName} 岗位职责 JD 中国`],
      evidence: careerName === '内容策划' ? [trustedEvidence] : [],
      status: careerName === '内容策划' ? 'partial' : 'unavailable',
      confidence: 'low',
      note: careerName === '内容策划' ? '少量来源' : '当前公开信息不足',
      cacheStatus: 'miss',
    }));
    const modelReport = createSampleCareerReport(request);
    generateContentStream.mockImplementation(async function* () { yield { text: JSON.stringify(modelReport) }; });
    generateContent.mockImplementation(async ({ contents }: { contents: string }) => {
      if (contents.includes('产品运营')) throw new Error('one career failed');
      const title = contents.includes('内容策划') ? '内容策划' : '用户研究助理';
      const validation = structuredClone(modelReport.careerHypotheses.find((item) => item.title === title)?.workValidation);
      if (!validation) throw new Error('missing fixture');
      validation.status = 'complete';
      validation.workReality.evidence = [{
        ...trustedEvidence,
        url: 'https://evil.example/fabricated',
        fact: '模型编造的事实',
      }];
      validation.capabilitySignals.hardBarriers = [{
        barrier: '模型声称的法定资格', explanation: '没有官方来源', evidenceStatus: 'verified',
      }];
      return { text: JSON.stringify(validation) };
    });

    const stream = generateCareerReportStream(request);
    await stream.next();
    const result = await stream.next();
    if (!result.done || !result.value || !('kind' in result.value)) throw new Error('missing report');

    const [first, failed, third] = result.value.careerHypotheses;
    expect(first.workValidation?.workReality.evidence).toEqual([trustedEvidence]);
    expect(first.workValidation?.capabilitySignals.hardBarriers[0].evidenceStatus).toBe('uncertain');
    expect(failed.workValidation).toMatchObject({ status: 'unavailable', careerName: '产品运营' });
    expect(failed.workValidation?.note).toContain('单个职业');
    expect(third.workValidation?.careerName).toBe('用户研究助理');
    expect(researchCareerValidation).toHaveBeenCalledTimes(3);
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('runs independent career research and validation concurrently to stay within the report deadline', async () => {
    researchCareerMarket.mockResolvedValue({
      status: 'unavailable', retrievedAt: null, sources: [], note: '候选阶段没有市场来源',
    });
    const modelReport = createSampleCareerReport(request);
    generateContentStream.mockImplementation(async function* () { yield { text: JSON.stringify(modelReport) }; });

    let releaseResearch = () => {};
    const researchGate = new Promise<void>((resolve) => { releaseResearch = resolve; });
    researchCareerValidation.mockImplementation(async (careerName: string) => {
      await researchGate;
      return {
        careerName,
        checkedAt: '2026-09-30T08:00:00.000Z',
        queries: [`${careerName} 岗位职责 JD 中国`],
        evidence: [],
        status: 'unavailable',
        confidence: 'low',
        note: '当前公开信息不足',
        cacheStatus: 'miss',
      };
    });

    let releaseValidation = () => {};
    const validationGate = new Promise<void>((resolve) => { releaseValidation = resolve; });
    generateContent.mockImplementation(async ({ contents }: { contents: string }) => {
      await validationGate;
      const title = ['内容策划', '产品运营', '用户研究助理'].find((value) => contents.includes(value)) ?? '目标岗位';
      const validation = modelReport.careerHypotheses.find((item) => item.title === title)?.workValidation;
      return { text: JSON.stringify(validation) };
    });

    const stream = generateCareerReportStream(request);
    await stream.next();
    const completed = stream.next();

    await vi.waitFor(() => expect(researchCareerValidation).toHaveBeenCalledTimes(3));
    releaseResearch();
    await vi.waitFor(() => expect(generateContent).toHaveBeenCalledTimes(3));
    releaseValidation();

    const result = await completed;
    expect(result.done).toBe(true);
    if (!result.done || !result.value || !('kind' in result.value)) throw new Error('missing report');
    expect(result.value.careerHypotheses.every((item) => item.workValidation)).toBe(true);
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
