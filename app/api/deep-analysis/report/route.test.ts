import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDeepReportHandler } from './route';

const report = {
  title: '职业方向', summary: '摘要', keyFindings: ['A', 'B'],
  cards: [{ id: 'c1', title: '结论', summary: '简述', details: ['详情'], evidence: [] }, { id: 'c2', title: '验证', summary: '简述', details: ['详情'], evidence: [] }],
  risks: [{ title: '风险', detail: '细节', mitigation: '应对' }],
  nextActions: [{ title: '行动1', detail: '做事', timeframe: '一周' }, { title: '行动2', detail: '复盘', timeframe: '一月' }],
  reflectionQuestions: [], disclaimer: '仅供探索。',
};
const validAnswers = {
  work_q1: { optionIds: ['work_q1_student'] }, work_q2: { optionIds: ['work_q2_content'] },
  work_q3: { optionIds: ['work_q3_ideas'] }, work_q4: { optionIds: ['work_q4_repetitive'] },
  work_q5: { optionIds: ['work_q5_growth'] },
};
const valid = {
  sessionId: 'session-12345678', paymentReceipt: 'signed-receipt',
  birthInput: { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州' },
  freeReport: { disclaimer: '只供参考', sections: [{ heading: '性格', body: '内容', bullets: [] }] },
  selectedDirection: 'work', questionnaireVersion: 'v1', answers: validAnswers,
  optionalContext: '', customQuestion: null, customQuestions: [],
};
const request = (body: unknown) => new Request('http://localhost/api/deep-analysis/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const readEvents = async (response: Response) => (await response.text()).split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')));

const generate = vi.fn();
const persist = vi.fn();
const verifyReceipt = vi.fn();

beforeEach(() => {
  generate.mockReset(); persist.mockReset(); verifyReceipt.mockReset();
  verifyReceipt.mockReturnValue({ success: true, payload: {} });
  persist.mockResolvedValue({ persisted: true });
  generate.mockImplementation(async function* () { yield JSON.stringify(report); });
});

describe('POST /api/deep-analysis/report', () => {
  it('rejects direct API answers above maxSelect before calling Gemini', async () => {
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt });
    const response = await POST(request({ ...valid, answers: { ...validAnswers, work_q4: { optionIds: ['work_q4_repetitive', 'work_q4_social', 'work_q4_isolated', 'work_q4_controlled'] } } }));
    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects an invalid payment receipt', async () => {
    verifyReceipt.mockReturnValue({ success: false });
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt });
    const response = await POST(request(valid));
    expect(response.status).toBe(402);
    expect(generate).not.toHaveBeenCalled();
  });

  it('delivers a valid report even when persistence is unavailable', async () => {
    persist.mockResolvedValue({ persisted: false });
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt });
    const events = await readEvents(await POST(request(valid)));
    expect(events.at(-1)).toEqual({ type: 'report', report });
  });

  it('delivers a valid report even when the persistence dependency throws', async () => {
    persist.mockRejectedValue(new Error('database offline'));
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt });
    const events = await readEvents(await POST(request(valid)));
    expect(events.at(-1)).toEqual({ type: 'report', report });
  });

  it('rejects multiple selections for a custom single-choice question', async () => {
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt });
    const response = await POST(request({
      ...valid,
      selectedDirection: 'custom',
      customQuestion: '我是否应该转岗？',
      customQuestions: [1, 2, 3].map((number) => ({
        id: `custom_q${number}`,
        type: 'single',
        text: `补充问题 ${number}`,
        required: true,
        options: [{ id: `custom_q${number}_a`, label: '选项 A' }, { id: `custom_q${number}_b`, label: '选项 B' }],
      })),
      answers: {
        custom_q1: { optionIds: ['custom_q1_a', 'custom_q1_b'] },
        custom_q2: { optionIds: ['custom_q2_a'] },
        custom_q3: { optionIds: ['custom_q3_a'] },
      },
    }));
    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it('buffers model chunks server-side and only streams validated status and report events', async () => {
    generate.mockImplementation(async function* () {
      const value = JSON.stringify(report);
      yield value.slice(0, 20);
      yield value.slice(20);
    });
    const POST = createDeepReportHandler({ generate, persist, verifyReceipt });
    const events = await readEvents(await POST(request(valid)));
    expect(events.some((event) => event.type === 'delta')).toBe(false);
    expect(events.filter((event) => event.type === 'status').map((event) => event.stage)).toEqual([
      'preparing', 'analyzing', 'structuring', 'validating',
    ]);
    expect(events.at(-1)).toEqual({ type: 'report', report });
  });
});
