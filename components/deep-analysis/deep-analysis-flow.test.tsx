import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { createInitialDeepState, loadDeepSession, saveDeepSession } from '@/lib/deep-analysis/session';
import { DeepAnalysisFlow } from './deep-analysis-flow';

const props = {
  birthInput: { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州' },
  freeReport: { disclaimer: '只供参考', sections: [{ heading: '性格', body: '内容', bullets: [] }] },
  price: '¥29.90',
};

const deepReport = {
  title: '你的职业方向深度分析', summary: '先验证最重要的方向。', keyFindings: ['聚焦', '验证'],
  cards: [{ id: 'c1', title: '方向', summary: '摘要', details: ['详情'], evidence: [] }, { id: 'c2', title: '边界', summary: '摘要', details: ['详情'], evidence: [] }],
  risks: [{ title: '风险', detail: '细节', mitigation: '应对' }],
  nextActions: [{ title: '行动一', detail: '执行', timeframe: '本周' }, { title: '行动二', detail: '复盘', timeframe: '下周' }],
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

it('starts with five freely selectable exploration directions', async () => {
  render(<DeepAnalysisFlow {...props} />);
  expect(await screen.findByText('接下来，你最想进一步弄清楚什么？')).toBeTruthy();
  expect(screen.getByRole('button', { name: /我适合做什么工作/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /我有其他问题/ })).toBeTruthy();
});

it('opens the first fixed question only after choosing a direction', async () => {
  render(<DeepAnalysisFlow {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: /我适合做什么工作/ }));
  expect(screen.getByText('第 1 / 5 题')).toBeTruthy();
  expect(screen.getByText('你目前处于什么状态？')).toBeTruthy();
});

it('restores stored progress after mount instead of losing answers', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'work',
    step: 'questions',
    questionIndex: 1,
    answers: { work_q1: { optionIds: ['work_q1_student'] } },
  }, window.sessionStorage);

  render(<DeepAnalysisFlow {...props} />);
  expect(await screen.findByText('第 2 / 5 题')).toBeTruthy();
});

it('uses a direction-specific payment title', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'city',
    step: 'payment',
  }, window.sessionStorage);
  render(<DeepAnalysisFlow {...props} />);
  expect(await screen.findByText('你的城市发展深度分析已经准备好')).toBeTruthy();
});

it('offers popular cities and requires a name only when another city is selected', async () => {
  render(<DeepAnalysisFlow {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: /我更适合在哪类城市发展/ }));

  expect(screen.getByRole('radio', { name: '北京' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: '上海' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: '广州' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: '深圳' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: '杭州' })).toBeTruthy();
  expect(screen.queryByLabelText('请输入目前生活的城市')).toBeNull();

  fireEvent.click(screen.getByRole('radio', { name: '其他城市' }));
  const continueButton = screen.getByRole('button', { name: '继续' }) as HTMLButtonElement;
  expect(continueButton.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('请输入目前生活的城市'), { target: { value: '成都' } });
  expect(continueButton.disabled).toBe(false);
  fireEvent.click(continueButton);
  expect(screen.getByText('你能够接受的发展范围？')).toBeTruthy();
});

it('saves a completed report and opens the dedicated report page', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'work',
    step: 'payment',
    paymentReceipt: 'signed-receipt',
    answers: {
      work_q1: { optionIds: ['work_q1_student'] }, work_q2: { optionIds: ['work_q2_content'] },
      work_q3: { optionIds: ['work_q3_ideas'] }, work_q4: { optionIds: ['work_q4_repetitive'] },
      work_q5: { optionIds: ['work_q5_growth'] },
    },
  }, window.sessionStorage);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'report', report: deepReport })}\n\n`));
    controller.close();
  } }), { status: 200 })));

  render(<DeepAnalysisFlow {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: '生成我的深度报告' }));

  await waitFor(() => expect(push).toHaveBeenCalledWith('/deep-report'));
  expect(loadDeepSession(window.sessionStorage)?.report?.title).toBe('你的职业方向深度分析');
});

it('stores a pending Alipay order before redirecting to the sandbox cashier', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'city',
    step: 'payment',
  }, window.sessionStorage);
  const redirectToCheckout = vi.fn();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
    status: 'pending',
    orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
    checkoutUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do?signed=1',
  })));

  render(<DeepAnalysisFlow {...props} paymentMode="alipay_sandbox" redirectToCheckout={redirectToCheckout} />);
  fireEvent.click(await screen.findByRole('button', { name: '前往支付宝沙箱付款' }));

  await waitFor(() => expect(redirectToCheckout).toHaveBeenCalledWith('https://openapi-sandbox.dl.alipaydev.com/gateway.do?signed=1'));
  expect(loadDeepSession(window.sessionStorage)?.paymentOrderId).toBe('07a6ec32-8a87-4e77-9f24-fd807084b8f6');
});

it('resumes a returned Alipay order when the stored session lost the order id', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'work',
    step: 'payment',
    answers: {
      work_q1: { optionIds: ['work_q1_student'] }, work_q2: { optionIds: ['work_q2_content'] },
      work_q3: { optionIds: ['work_q3_ideas'] }, work_q4: { optionIds: ['work_q4_repetitive'] },
      work_q5: { optionIds: ['work_q5_growth'] },
    },
  }, window.sessionStorage);
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ status: 'paid', receipt: 'server-signed-receipt' }))
    .mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'report', report: deepReport })}\n\n`));
      controller.close();
    } }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  render(<DeepAnalysisFlow {...props} paymentMode="alipay_sandbox" returnedOrderId="07a6ec32-8a87-4e77-9f24-fd807084b8f6" />);

  await waitFor(() => expect(push).toHaveBeenCalledWith('/deep-report'));
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
    orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
    sessionId: 'session-12345678',
  });
});

it('confirms a returned sandbox order with the server before generating the report', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'work',
    step: 'payment',
    paymentOrderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
    answers: {
      work_q1: { optionIds: ['work_q1_student'] }, work_q2: { optionIds: ['work_q2_content'] },
      work_q3: { optionIds: ['work_q3_ideas'] }, work_q4: { optionIds: ['work_q4_repetitive'] },
      work_q5: { optionIds: ['work_q5_growth'] },
    },
  }, window.sessionStorage);
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ status: 'paid', receipt: 'server-signed-receipt' }))
    .mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'report', report: deepReport })}\n\n`));
      controller.close();
    } }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  render(<DeepAnalysisFlow {...props} paymentMode="alipay_sandbox" />);

  await waitFor(() => expect(push).toHaveBeenCalledWith('/deep-report'));
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/deep-analysis/payment/status');
  expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/deep-analysis/report');
});

it('keeps a compact entry on the free-report page after a deep report exists', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'work',
    step: 'report',
    report: deepReport,
  }, window.sessionStorage);

  render(<DeepAnalysisFlow {...props} />);
  const openButton = await screen.findByRole('button', { name: '查看深度报告' });
  expect(screen.queryByText('先看结论')).toBeNull();
  fireEvent.click(openButton);
  expect(push).toHaveBeenCalledWith('/deep-report');
});

it('explains which step failed and whether paying again is needed', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'work',
    step: 'payment',
    paymentReceipt: 'signed-receipt',
  }, window.sessionStorage);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', code: 'parse_failed', message: '报告解析失败，请重试。' })}\n\n`));
    controller.close();
  } }), { status: 200 })));

  render(<DeepAnalysisFlow {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: '生成我的深度报告' }));

  expect(await screen.findByText('报告内容整理失败')).toBeTruthy();
  expect(screen.getByText(/不需要再次付款/)).toBeTruthy();
  expect(screen.getByText('已完成支付，无需重复付款。')).toBeTruthy();
});

it('lets the reader step back and edit answers before generating', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'work',
    step: 'payment',
    answers: {
      work_q1: { optionIds: ['work_q1_student'] }, work_q2: { optionIds: ['work_q2_content'] },
      work_q3: { optionIds: ['work_q3_ideas'] }, work_q4: { optionIds: ['work_q4_repetitive'] },
      work_q5: { optionIds: ['work_q5_growth'] },
    },
  }, window.sessionStorage);

  render(<DeepAnalysisFlow {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: '修改答案' }));
  expect(screen.getByText('还有什么现实情况希望我们考虑？')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: '上一步' }));
  expect(screen.getByText('第 5 / 5 题')).toBeTruthy();
});
