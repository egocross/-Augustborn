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
