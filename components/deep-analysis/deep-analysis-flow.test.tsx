import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { normalizeCareerCalibration, type CareerDraftAnswers } from '@/lib/deep-analysis/career-calibration';
import { createInitialCareerState, loadDeepSession, saveDeepSession } from '@/lib/deep-analysis/session';
import { DeepAnalysisFlow } from './deep-analysis-flow';

const freeReport = { disclaimer: '只供参考', sections: [{ heading: '性格', body: '内容', bullets: [] }] };
const props = { baseReportSnapshotToken: 'v1.digest.signature', freeReport, price: '¥29.90' };

const completeAnswers = (): CareerDraftAnswers => ({
  career_status: { optionIds: ['career_status_first_job'] },
  transition_urgency: { optionIds: ['transition_3_months'] },
  minimum_income: { optionIds: ['minimum_income_3000_5000'] },
  salary_drop_tolerance: { optionIds: ['salary_drop_none'] },
  responsibilities: { optionIds: ['responsibility_none'] },
  location_mobility: { optionIds: ['mobility_nationwide'] },
  weekly_hours: { optionIds: ['weekly_hours_full_time'] },
  preparation_horizon: { optionIds: ['preparation_3_6_months'] },
  max_budget: { optionIds: ['budget_1000_3000'] },
  career_capital: { optionIds: ['capital_none'] },
  restart_tolerance: { optionIds: ['restart_entry_level'] },
  education_tolerance: { optionIds: ['education_systematic_training'] },
  work_constraints: { optionIds: ['work_constraint_none'] },
  income_models: { optionIds: ['income_model_any'] },
  employment_types: { optionIds: ['employment_type_any'] },
  career_values: { optionIds: ['value_growth'] },
});

const deepReport = {
  title: '你的职业专项报告', summary: '先验证最重要的方向。', keyFindings: ['聚焦', '验证'],
  cards: [
    { id: 'c1', title: '方向', summary: '摘要', details: ['详情'], evidence: [] },
    { id: 'c2', title: '边界', summary: '摘要', details: ['详情'], evidence: [] },
  ],
  risks: [{ title: '风险', detail: '细节', mitigation: '应对' }],
  nextActions: [
    { title: '行动一', detail: '执行', timeframe: '本周' },
    { title: '行动二', detail: '复盘', timeframe: '下周' },
  ],
  reflectionQuestions: [], disclaimer: '仅供探索。',
};

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('starts with a short career-calibration introduction and no legacy directions', async () => {
  render(<DeepAnalysisFlow {...props} />);

  expect(await screen.findByRole('heading', { name: '把基础倾向放进现实条件里校准' })).toBeTruthy();
  expect(screen.getByText(/约 2–4 分钟/)).toBeTruthy();
  expect(screen.queryByText('接下来，你最想进一步弄清楚什么？')).toBeNull();
  expect(screen.queryByText(/第 \d+ \/ \d+ 题/)).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: '开始现实校准' }));
  expect(screen.getByText('当前状态')).toBeTruthy();
  expect(screen.getByText('你现在处于什么职业状态？')).toBeTruthy();
});

it('automatically advances after an ordinary single-choice answer', async () => {
  render(<DeepAnalysisFlow {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: '开始现实校准' }));
  fireEvent.click(screen.getByRole('radio', { name: '第一次正式求职' }));

  expect(await screen.findByText('你希望多快开始进入新的职业方向？')).toBeTruthy();
  expect(screen.queryByText(/第 \d+ \/ \d+ 题/)).toBeNull();
});

it('restores stored progress with a stage name rather than a global question count', async () => {
  saveDeepSession({
    ...createInitialCareerState('session-12345678', props),
    step: 'questions', sectionIndex: 0, questionIndex: 1,
    answers: { career_status: { optionIds: ['career_status_first_job'] } },
  }, window.sessionStorage);
  render(<DeepAnalysisFlow {...props} />);

  expect(await screen.findByText('你希望多快开始进入新的职业方向？')).toBeTruthy();
  expect(screen.getByText('当前状态')).toBeTruthy();
});

it('requires a reality summary confirmation before payment', async () => {
  const answers = completeAnswers();
  saveDeepSession({
    ...createInitialCareerState('session-12345678', props),
    step: 'summary', answers,
  }, window.sessionStorage);
  render(<DeepAnalysisFlow {...props} />);

  expect(await screen.findByRole('heading', { name: '现实条件摘要' })).toBeTruthy();
  expect(screen.queryByText('你的职业专项分析已经准备好')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '确认并继续' }));
  expect(screen.getByText('你的职业专项分析已经准备好')).toBeTruthy();
});

it('sends only the signed base report and normalized career calibration to generation', async () => {
  const answers = completeAnswers();
  const calibration = normalizeCareerCalibration(answers);
  saveDeepSession({
    ...createInitialCareerState('session-12345678', props),
    step: 'payment', answers, calibration, summaryConfirmed: true, paymentReceipt: 'signed-receipt',
  }, window.sessionStorage);
  const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'report', report: deepReport })}\n\n`));
      controller.close();
    },
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  render(<DeepAnalysisFlow {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: '生成我的职业专项报告' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/deep-report'));

  const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
  expect(body).toMatchObject({
    sessionId: 'session-12345678', questionnaireVersion: 'career-v1',
    baseReport: freeReport, baseReportSnapshotToken: 'v1.digest.signature', careerCalibration: calibration,
  });
  expect(body).not.toHaveProperty('birthInput');
  expect(body).not.toHaveProperty('selectedDirection');
  expect(body).not.toHaveProperty('answers');
  expect(loadDeepSession(window.sessionStorage)?.report?.title).toBe('你的职业专项报告');
});

it('keeps the payment request scoped to the career session', async () => {
  const answers = completeAnswers();
  const calibration = normalizeCareerCalibration(answers);
  saveDeepSession({
    ...createInitialCareerState('session-12345678', props),
    step: 'payment', answers, calibration, summaryConfirmed: true,
  }, window.sessionStorage);
  const redirectToCheckout = vi.fn();
  const fetchMock = vi.fn().mockResolvedValue(Response.json({
    status: 'pending', orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
    checkoutUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do?signed=1',
  }));
  vi.stubGlobal('fetch', fetchMock);

  render(<DeepAnalysisFlow {...props} paymentMode="alipay_sandbox" redirectToCheckout={redirectToCheckout} />);
  fireEvent.click(await screen.findByRole('button', { name: '前往支付宝沙箱付款' }));

  await waitFor(() => expect(redirectToCheckout).toHaveBeenCalledOnce());
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ sessionId: 'session-12345678' });
});
