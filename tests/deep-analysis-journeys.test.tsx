import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { BirthForm } from '@/components/birth-form';
import { loadDeepSession } from '@/lib/deep-analysis/session';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const freeReport = { disclaimer: '仅供参考', sections: [{ heading: '核心性格与底层矛盾', body: '你倾向先理清问题再行动。', bullets: [] }] };
const deepReport = {
  title: '你的专项深度分析', summary: '优先用低成本实验验证方向。', keyFindings: ['优先专注', '核对现实约束'],
  cards: [{ id: 'c1', title: '优先方向', summary: '从真实任务出发', details: ['完成一次小型交付'], evidence: ['问卷答案'] }, { id: 'c2', title: '排除条件', summary: '避免长期无反馈', details: ['在面试中核对'], evidence: [] }],
  risks: [{ title: '过度分析', detail: '可能拖延行动', mitigation: '设置截止时间' }],
  nextActions: [{ title: '列出选项', detail: '保留三个', timeframe: '本周' }, { title: '完成访谈', detail: '核对真实工作', timeframe: '两周内' }],
  reflectionQuestions: [], disclaimer: '仅用于自我探索。',
};

const sseResponse = (events: unknown[]) => new Response(new ReadableStream<Uint8Array>({ start(controller) {
  const encoder = new TextEncoder();
  events.forEach((event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)));
  controller.close();
} }), { status: 200, headers: { 'content-type': 'text/event-stream' } });

const customQuestions = [1, 2, 3].map((number) => ({
  id: `custom_q${number}`, type: 'single', text: `补充问题 ${number}`, required: true,
  options: [{ id: `custom_q${number}_a`, label: '选项 A' }, { id: `custom_q${number}_b`, label: '选项 B' }],
}));

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/analyze') return sseResponse([{ type: 'delta', text: JSON.stringify(freeReport) }, { type: 'report', report: freeReport }]);
    if (url === '/api/deep-analysis/custom-questions') return Response.json({ questions: customQuestions });
    if (url === '/api/deep-analysis/payment') return Response.json({ status: 'paid', receipt: 'signed-receipt', price: '¥29.90' });
    if (url === '/api/deep-analysis/report') return sseResponse([{ type: 'status', stage: 'preparing' }, { type: 'heartbeat' }, { type: 'report', report: deepReport }]);
    throw new Error(`Unexpected URL: ${url}`);
  }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function createFreeReport() {
  render(<BirthForm deepReportPrice="¥29.90" />);
  fireEvent.change(screen.getByLabelText('出生日期'), { target: { value: '1977-10-15' } });
  fireEvent.change(screen.getByLabelText('出生时间'), { target: { value: '13:30' } });
  fireEvent.click(screen.getByRole('button', { name: '生成我的探索报告' }));
  await screen.findByText('接下来，你最想进一步弄清楚什么？');
}

const continueButton = () => screen.getByRole('button', { name: '继续' });

async function finishAndGenerate() {
  fireEvent.click(screen.getByRole('button', { name: '查看深度报告说明' }));
  expect(screen.getByText('¥29.90')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '生成我的深度报告' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/deep-report'));
  expect(loadDeepSession(window.sessionStorage)?.report?.title).toBe('你的专项深度分析');
}

it('completes free report to work direction to paid deep report', async () => {
  await createFreeReport();
  fireEvent.click(screen.getByRole('button', { name: /我适合做什么工作/ }));
  for (const label of ['学生', '内容创作', '提出新的点子', '高度重复', '快速成长']) {
    fireEvent.click(screen.getByLabelText(label)); fireEvent.click(continueButton());
  }
  await finishAndGenerate();
});

it('completes free report to city direction to paid deep report', async () => {
  await createFreeReport();
  fireEvent.click(screen.getByRole('button', { name: /我更适合在哪类城市发展/ }));
  fireEvent.change(screen.getByLabelText('你目前主要生活在哪个城市？'), { target: { value: '杭州' } }); fireEvent.click(continueButton());
  fireEvent.click(screen.getByLabelText('可以考虑国内其他城市'));
  fireEvent.change(screen.getByLabelText('已经有考虑的城市？'), { target: { value: '上海、成都、上海' } });
  fireEvent.click(continueButton());
  for (const label of ['工作机会多', '深耕某个专业领域', '家庭 / 伴侣']) {
    fireEvent.click(screen.getByLabelText(label)); fireEvent.click(continueButton());
  }
  await finishAndGenerate();
});

it('completes custom question through generated follow-ups to paid deep report', async () => {
  await createFreeReport();
  fireEvent.click(screen.getByRole('button', { name: /我有其他问题/ }));
  fireEvent.change(screen.getByLabelText('我的问题'), { target: { value: '我是否应该转岗？' } }); fireEvent.click(continueButton());
  await screen.findByText('补充问题 1');
  for (let number = 1; number <= 3; number += 1) {
    fireEvent.click(screen.getByLabelText('选项 A')); fireEvent.click(continueButton());
  }
  await finishAndGenerate();
});
