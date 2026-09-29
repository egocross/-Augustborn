import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { createInitialCareerState, saveDeepSession } from '@/lib/deep-analysis/session';
import { DeepExplorationPage } from './deep-exploration-page';

const freeReport = { disclaimer: '仅供参考', sections: [{ heading: '核心性格', body: '内容', bullets: [] }] };
const context = { baseReportSnapshotToken: 'v1.digest.signature', freeReport };

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/explore');
  push.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/explore');
});

it('renders the single career-calibration introduction', async () => {
  saveDeepSession(createInitialCareerState('session-12345678', context), window.sessionStorage);
  render(<DeepExplorationPage price="¥29.90" />);

  expect(await screen.findByText('把基础倾向放进现实条件里校准')).toBeTruthy();
  expect(screen.queryByText('我适合进入什么行业')).toBeNull();
  expect(screen.queryByText('我有其他问题')).toBeNull();
});

it('restores career questionnaire progress', async () => {
  saveDeepSession({
    ...createInitialCareerState('session-12345678', context),
    step: 'questions', sectionIndex: 0, questionIndex: 1,
    answers: { career_status: { optionIds: ['career_status_first_job'] } },
  }, window.sessionStorage);
  render(<DeepExplorationPage price="¥29.90" />);

  expect(await screen.findByText('你希望多快开始进入新的职业方向？')).toBeTruthy();
  expect(screen.getByText('当前状态')).toBeTruthy();
});

it('offers safe recovery when the current tab has no base report', async () => {
  render(<DeepExplorationPage price="¥29.90" />);

  expect(await screen.findByText('当前标签页还没有可继续的探索内容')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
  expect(push).toHaveBeenCalledWith('/');
});

it('keeps an unsigned old base report readable but blocks the career flow', async () => {
  saveDeepSession(createInitialCareerState('session-12345678', { freeReport }), window.sessionStorage);
  // v3 unsigned sessions are intentionally rejected, so emulate the supported v2 migration path.
  window.sessionStorage.setItem('jianvia.deep-analysis', JSON.stringify({
    version: 2, state: { sessionId: 'session-12345678', step: 'direction', freeReport },
  }));
  render(<DeepExplorationPage price="¥29.90" />);

  expect(await screen.findByText(/基础报告仍可阅读，但暂时不能进入职业专项分析/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '请重新生成基础报告' }));
  expect(push).toHaveBeenCalledWith('/');
});

it('explains a completed payment when this tab lost the session', async () => {
  window.history.replaceState({}, '', '/explore?payment_order=07a6ec32-8a87-4e77-9f24-fd807084b8f6');
  render(<DeepExplorationPage price="¥29.90" />);

  expect(await screen.findByText('这笔支付已经完成，但当前标签页没有对应的探索记录')).toBeTruthy();
  expect(screen.getByText(/只保存在发起支付的那个标签页里/)).toBeTruthy();
});
