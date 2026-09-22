import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { createInitialDeepState, saveDeepSession } from '@/lib/deep-analysis/session';
import { DeepExplorationPage } from './deep-exploration-page';

const context = {
  birthInput: { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州' },
  freeReport: { disclaimer: '仅供参考', sections: [{ heading: '核心性格', body: '内容', bullets: [] }] },
};

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/explore');
  push.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/explore');
});

it('renders direction choices on the dedicated exploration page', async () => {
  saveDeepSession(createInitialDeepState('session-12345678', context), window.sessionStorage);
  render(<DeepExplorationPage price="¥29.90" />);

  expect(await screen.findByText('接下来，你最想进一步弄清楚什么？')).toBeTruthy();
  expect(screen.getByRole('button', { name: '返回基础报告' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /我适合做什么工作/ })).toBeTruthy();
});

it('restores questionnaire progress instead of returning to direction choices', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', context),
    selectedDirection: 'work',
    step: 'questions',
    questionIndex: 1,
    answers: { work_q1: { optionIds: ['work_q1_student'] } },
  }, window.sessionStorage);
  render(<DeepExplorationPage price="¥29.90" />);

  expect(await screen.findByText('第 2 / 5 题')).toBeTruthy();
  expect(screen.queryByText('接下来，你最想进一步弄清楚什么？')).toBeNull();
});

it('returns to the free report from the exploration page', async () => {
  saveDeepSession(createInitialDeepState('session-12345678', context), window.sessionStorage);
  render(<DeepExplorationPage price="¥29.90" />);

  fireEvent.click(await screen.findByRole('button', { name: '返回基础报告' }));
  expect(push).toHaveBeenCalledWith('/');
});

it('offers safe recovery when the current tab has no free report context', async () => {
  render(<DeepExplorationPage price="¥29.90" />);

  expect(await screen.findByText('当前标签页还没有可继续的探索内容')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
  expect(push).toHaveBeenCalledWith('/');
});

it('explains a completed payment when this tab lost the exploration record', async () => {
  window.history.replaceState({}, '', '/explore?payment_order=07a6ec32-8a87-4e77-9f24-fd807084b8f6');
  render(<DeepExplorationPage price="¥29.90" />);

  expect(await screen.findByText('这笔支付已经完成，但当前标签页没有对应的探索记录')).toBeTruthy();
  expect(screen.getByText(/只保存在发起支付的那个标签页里/)).toBeTruthy();
});
