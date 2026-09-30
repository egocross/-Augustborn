import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import type { ValidationNextAction, ValidationResult as ValidationResultType } from '@/lib/career-validation/schema';
import { ValidationResultView } from './validation-result';

afterEach(cleanup);

function makeResult(nextAction: Partial<ValidationNextAction> = {}): ValidationResultType {
  return {
    status: 'worth_continuing',
    validatedQuestion: '我能否独立完成一次内容策划任务？',
    evidence: [{
      dimension: 'task_performance', signal: 'support',
      observation: '60 分钟内完成了结构拆解和初稿。',
      interpretation: '独立完成核心任务的门槛不高。',
      limitation: '只有一次样本，不能推断长期稳定性。',
    }],
    supportingEvidence: ['初稿结构完整'],
    riskSignals: ['反复修改的耐受度尚未验证'],
    unknowns: ['真实协作方的反馈未知'],
    reasoning: '任务表现支持继续验证，但体验证据只有一次。',
    nextAction: {
      type: 'external_validation', title: '找一位从业者核对日常工作',
      detail: '用 20 分钟核对重复任务、修改频率与入场门槛。', cost: '0 元', canStartInProduct: false,
      ...nextAction,
    },
    analyzedAt: '2026-09-30T10:00:00.000Z',
    generationMetadata: { evaluationPromptVersion: 'v1', rubricVersion: 'v1', evaluationModelId: 'sample' },
  };
}

it('shows the verdict, evidence labels, and the single next action', () => {
  render(<ValidationResultView onStartNext={() => {}} result={makeResult()} />);

  expect(screen.getByText('值得继续验证')).toBeTruthy();
  expect(screen.getByText('任务表现')).toBeTruthy();
  expect(screen.getByText('支持')).toBeTruthy();
  expect(screen.getByText('初稿结构完整')).toBeTruthy();
  expect(screen.getByText('反复修改的耐受度尚未验证')).toBeTruthy();
  expect(screen.getByText('真实协作方的反馈未知')).toBeTruthy();
  expect(screen.getByRole('heading', { name: '找一位从业者核对日常工作' })).toBeTruthy();
});

it('renders user-visible text safely instead of raw HTML', () => {
  const hostile = makeResult({
    title: '<img src=x onerror=alert(1)>核对日常工作',
    detail: '<script>alert(1)</script>用真实岗位信息核对。',
  });
  const { container } = render(<ValidationResultView onStartNext={() => {}} result={hostile} />);

  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('script')).toBeNull();
  expect(screen.getByText('<script>alert(1)</script>用真实岗位信息核对。')).toBeTruthy();
});

it('only offers the in-product next experiment button for the product action', () => {
  const onStartNext = vi.fn();
  const { rerender } = render(<ValidationResultView onStartNext={onStartNext} result={makeResult()} />);
  expect(screen.queryByRole('button', { name: '开始下一轮验证' })).toBeNull();

  const product = makeResult({ type: 'in_product_experiment', canStartInProduct: true, title: '做第二次工作样本' });
  rerender(<ValidationResultView onStartNext={onStartNext} result={product} />);
  fireEvent.click(screen.getByRole('button', { name: '开始下一轮验证' }));
  expect(onStartNext).toHaveBeenCalledTimes(1);
});

it.each([
  'external_validation', 'market_contact', 'bridge_path', 'credential_check', 'real_project', 'pause',
] as const)('keeps %s outside the product without a next-round button', (type) => {
  const onStartNext = vi.fn();
  render(<ValidationResultView onStartNext={onStartNext} result={makeResult({ type })} />);
  expect(screen.queryByRole('button', { name: '开始下一轮验证' })).toBeNull();
  expect(onStartNext).not.toHaveBeenCalled();
});
