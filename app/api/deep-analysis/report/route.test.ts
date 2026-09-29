import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CareerCalibration } from '@/lib/deep-analysis/career-calibration';
import { createSampleCareerReport } from '@/lib/report-provider/sample';
import { createDeepReportHandler } from './route';

const report = {
  title: '职业方向', summary: '摘要', keyFindings: ['A', 'B'],
  cards: [
    { id: 'c1', title: '结论', summary: '简述', details: ['详情'], evidence: [] },
    { id: 'c2', title: '验证', summary: '简述', details: ['详情'], evidence: [] },
  ],
  risks: [{ title: '风险', detail: '细节', mitigation: '应对' }],
  nextActions: [
    { title: '行动1', detail: '做事', timeframe: '一周' },
    { title: '行动2', detail: '复盘', timeframe: '一月' },
  ],
  reflectionQuestions: [], disclaimer: '仅供探索。',
};
const baseReport = { disclaimer: '只供参考', sections: [{ heading: '性格', body: '内容', bullets: [] }] };
const careerCalibration: CareerCalibration = {
  questionnaireVersion: 'career-v1',
  hardConstraints: {
    careerStatus: 'career_status_first_job', transitionUrgency: 'transition_3_months',
    income: {
      minimumIncomeBand: 'minimum_income_3000_5000', currency: 'CNY',
      salaryDropTolerance: 'salary_drop_none',
    },
    responsibilities: ['responsibility_none'],
    location: { mobility: 'mobility_nationwide', constraints: [] },
    transitionCapacity: {
      weeklyHours: 'weekly_hours_full_time', preparationHorizon: 'preparation_3_6_months',
      maxBudget: 'budget_1000_3000',
    },
    restartTolerance: 'restart_entry_level', educationTolerance: 'education_systematic_training',
    workConstraints: ['work_constraint_none'], incomeModels: ['income_model_any'],
    employmentTypes: ['employment_type_any'],
  },
  careerCapital: { experience: [], skills: [], evidence: [] },
  values: ['value_growth'],
};
const valid = {
  sessionId: 'session-12345678', paymentReceipt: 'signed-receipt',
  questionnaireVersion: 'career-v1', baseReport,
  baseReportSnapshotToken: 'v1.digest.signature', careerCalibration,
};
const request = (body: unknown) => new Request('http://localhost/api/deep-analysis/report', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const readEvents = async (response: Response) => (await response.text()).split('\n\n')
  .filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')));

const generate = vi.fn();
const persist = vi.fn();
const verifyReceipt = vi.fn();
const verifySnapshot = vi.fn();

beforeEach(() => {
  generate.mockReset();
  persist.mockReset();
  verifyReceipt.mockReset();
  verifySnapshot.mockReset();
  verifyReceipt.mockReturnValue({ success: true, payload: {} });
  verifySnapshot.mockReturnValue(true);
  persist.mockResolvedValue({ persisted: true });
  generate.mockImplementation(async function* () {
    yield JSON.stringify(report);
    return report;
  });
});

describe('POST /api/deep-analysis/report', () => {
  it('accepts only the signed career-calibration contract', async () => {
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt, verifySnapshot });
    const events = await readEvents(await POST(request(valid)));

    expect(events.at(-1)).toEqual({ type: 'report', report });
    expect(verifySnapshot).toHaveBeenCalledWith(baseReport, 'v1.digest.signature');
    expect(verifyReceipt).toHaveBeenCalledWith('signed-receipt', {
      sessionId: 'session-12345678', directionId: 'work',
    });
    expect(generate).toHaveBeenCalledWith({
      baseReport, careerCalibration, questionnaireVersion: 'career-v1',
    }, expect.objectContaining({ signal: expect.any(AbortSignal), onStage: expect.any(Function) }));
  });

  it.each([
    ['birthInput', { birthDate: '1977-10-15' }],
    ['answers', { work_q1: { optionIds: ['x'] } }],
    ['selectedDirection', 'work'],
    ['customQuestion', '我该做什么'],
    ['customQuestions', []],
    ['optionalContext', '额外文本'],
    ['chart', { dayMaster: '甲' }],
  ])('rejects legacy or extra field %s before verification', async (field, value) => {
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt, verifySnapshot });
    const response = await POST(request({ ...valid, [field]: value }));
    expect(response.status).toBe(400);
    expect(verifySnapshot).not.toHaveBeenCalled();
    expect(verifyReceipt).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it.each(['v1', 'v2', 'career-v0'])('rejects questionnaire version %s', async (questionnaireVersion) => {
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt, verifySnapshot });
    const response = await POST(request({ ...valid, questionnaireVersion }));
    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects a changed or unsigned base report before checking payment', async () => {
    verifySnapshot.mockReturnValue(false);
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt, verifySnapshot });
    const response = await POST(request({ ...valid, baseReport: { ...baseReport, disclaimer: 'changed' } }));
    expect(response.status).toBe(400);
    expect(verifySnapshot).toHaveBeenCalled();
    expect(verifyReceipt).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects an invalid career receipt before paid work starts', async () => {
    verifyReceipt.mockReturnValue({ success: false });
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt, verifySnapshot });
    const response = await POST(request(valid));
    expect(response.status).toBe(402);
    expect(generate).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('persists normalized calibration without birth data or raw draft answers', async () => {
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt, verifySnapshot });
    await readEvents(await POST(request(valid)));

    const event = persist.mock.calls.at(-1)?.[0];
    expect(event).toMatchObject({
      id: 'session-12345678', selectedDirection: 'work', questionnaireVersion: 'career-v1',
      careerCalibration, paymentStatus: 'paid', reportStatus: 'complete', reportResult: report,
    });
    expect(event).not.toHaveProperty('birthInput');
    expect(event).not.toHaveProperty('answers');
  });

  it('delivers a valid report even when optional persistence is unavailable', async () => {
    persist.mockRejectedValue(new Error('database offline'));
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt, verifySnapshot });
    const events = await readEvents(await POST(request(valid)));
    expect(events.at(-1)).toEqual({ type: 'report', report });
  });

  it('buffers model chunks and only emits validated status and report events', async () => {
    generate.mockImplementation(async function* (_input, options) {
      for (const stage of ['market_research', 'candidate_analysis', 'work_reality', 'capability_signals', 'validation_paths']) {
        options.onStage(stage);
      }
      const value = JSON.stringify(report);
      yield value.slice(0, 20);
      yield value.slice(20);
      return report;
    });
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt, verifySnapshot });
    const events = await readEvents(await POST(request(valid)));
    expect(events.some((event) => event.type === 'delta')).toBe(false);
    expect(events.filter((event) => event.type === 'status').map((event) => event.stage)).toEqual([
      'preparing', 'constraints', 'capital', 'market_research', 'candidate_analysis',
      'work_reality', 'capability_signals', 'validation_paths', 'validating',
    ]);
    expect(events.at(-1)).toEqual({ type: 'report', report });
  });

  it('delivers a partially successful paid report when one career lacks public evidence', async () => {
    const partial = createSampleCareerReport({
      baseReport,
      careerCalibration,
      questionnaireVersion: 'career-v1',
    });
    partial.careerHypotheses[1].workValidation = {
      ...partial.careerHypotheses[1].workValidation!,
      status: 'unavailable',
      note: '这个单个职业暂时没有足够公开数据。',
    };
    generate.mockImplementation(async function* () {
      yield JSON.stringify(partial);
      return partial;
    });
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt, verifySnapshot });

    const events = await readEvents(await POST(request(valid)));

    expect(events.at(-1)).toEqual({ type: 'report', report: partial });
    expect(events.some((event) => event.type === 'error')).toBe(false);
  });
});
