import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { createInitialDeepState, loadDeepSession, saveDeepSession } from '@/lib/deep-analysis/session';
import { DeepReportPage } from './deep-report-page';

const context = {
  birthInput: { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州' },
  freeReport: { disclaimer: '仅供参考', sections: [{ heading: '核心性格', body: '内容', bullets: [] }] },
};

const report = {
  title: '你的职业方向深度分析',
  summary: '先用低成本实验验证方向。',
  keyFindings: ['优先专注', '核对现实约束'],
  cards: [
    { id: 'c1', title: '优先方向', summary: '从真实任务出发', details: ['完成一次小型交付'], evidence: ['问卷答案'] },
    { id: 'c2', title: '排除条件', summary: '避免长期无反馈', details: ['在面试中核对'], evidence: [] },
  ],
  risks: [{ title: '过度分析', detail: '可能拖延行动', mitigation: '设置截止时间' }],
  nextActions: [
    { title: '列出选项', detail: '保留三个', timeframe: '本周' },
    { title: '完成访谈', detail: '核对真实工作', timeframe: '两周内' },
  ],
  reflectionQuestions: [],
  disclaimer: '仅用于自我探索。',
};

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
});

afterEach(() => cleanup());

function saveCompletedReport() {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', context),
    selectedDirection: 'work',
    step: 'report',
    paymentReceipt: 'signed-receipt',
    report,
    lastReport: report,
  }, window.sessionStorage);
}

it('renders the completed report from this tab without exposing birth data in the URL', async () => {
  saveCompletedReport();
  render(<DeepReportPage />);

  expect(await screen.findByRole('heading', { name: '你的职业方向深度分析' })).toBeTruthy();
  expect(screen.getByText('先看结论')).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: '报告操作' })).toBeNull();
  expect(screen.getByRole('button', { name: '重新选择探索方向' })).toBeTruthy();
});

it('resets only the paid flow and returns to the exploration picker', async () => {
  saveCompletedReport();
  render(<DeepReportPage />);

  fireEvent.click(await screen.findByRole('button', { name: '重新选择探索方向' }));
  expect(push).toHaveBeenCalledWith('/explore');
  const saved = loadDeepSession(window.sessionStorage);
  expect(saved?.step).toBe('direction');
  expect(saved?.report).toBeNull();
  expect(saved?.freeReport?.sections[0]?.heading).toBe('核心性格');
});

it('offers a safe recovery when no report exists in this tab', async () => {
  render(<DeepReportPage />);

  expect(await screen.findByText('这份深度报告已不在当前标签页中')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
  expect(push).toHaveBeenCalledWith('/');
});

it('still opens the finished report after choosing another direction', async () => {
  saveCompletedReport();
  const { unmount } = render(<DeepReportPage />);
  fireEvent.click(await screen.findByRole('button', { name: '重新选择探索方向' }));
  unmount();

  render(<DeepReportPage />);

  expect(await screen.findByRole('heading', { name: '你的职业方向深度分析' })).toBeTruthy();
});
