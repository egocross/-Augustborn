import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { QUESTION_BANK_V1, QUESTION_BANK_V2 } from '@/lib/deep-analysis/questions';
import { QuestionStep } from './question-step';

afterEach(() => cleanup());

it('renders option cards and enforces the multi-select limit', () => {
  const onChange = vi.fn();
  render(<QuestionStep answer={{ optionIds: ['work_q4_repetitive', 'work_q4_social', 'work_q4_isolated'] }} onChange={onChange} question={QUESTION_BANK_V1.work[3]} />);
  expect(screen.getByText('你最不希望长期处于哪种工作状态？')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: '被严格管理' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toContain('最多选择 3 项');
});

it('updates a single-select answer', () => {
  const onChange = vi.fn();
  const onSingleSelect = vi.fn();
  render(<QuestionStep answer={{}} onChange={onChange} onSingleSelect={onSingleSelect} question={QUESTION_BANK_V1.work[0]} />);
  fireEvent.click(screen.getByRole('radio', { name: '学生' }));
  expect(onChange).toHaveBeenCalledWith({ optionIds: ['work_q1_student'] });
  expect(onSingleSelect).toHaveBeenCalledTimes(1);
});

it('uses a compact option layout for short option lists and full width for long ones', () => {
  const { container, rerender } = render(<QuestionStep answer={{}} onChange={vi.fn()} question={QUESTION_BANK_V1.work[0]} />);
  expect(container.querySelector('.option-grid')?.getAttribute('data-layout')).toBe('compact');

  rerender(<QuestionStep answer={{}} onChange={vi.fn()} question={QUESTION_BANK_V1.industry[1]} />);
  expect(container.querySelector('.option-grid')?.getAttribute('data-layout')).toBe('standard');
});

it('lets a concrete choice replace the “no long-term problem” placeholder', () => {
  const onChange = vi.fn();
  render(<QuestionStep answer={{ optionIds: ['work_q4_none'] }} onChange={onChange} question={QUESTION_BANK_V1.work[3]} />);

  fireEvent.click(screen.getByRole('checkbox', { name: '被严格管理' }));

  expect(onChange).toHaveBeenCalledWith({ optionIds: ['work_q4_controlled'] });
});

it('keeps the placeholder exclusive when it is chosen last', () => {
  const onChange = vi.fn();
  render(<QuestionStep answer={{ optionIds: ['city_q5_parents', 'city_q5_children'] }} onChange={onChange} question={QUESTION_BANK_V1.city[4]} />);

  fireEvent.click(screen.getByRole('checkbox', { name: '没有明显限制' }));

  expect(onChange).toHaveBeenCalledWith({ optionIds: ['city_q5_none'] });
});

it('clears a previous question’s limit warning when the question changes', () => {
  const { rerender } = render(<QuestionStep answer={{ optionIds: ['work_q4_repetitive', 'work_q4_social', 'work_q4_isolated'] }} onChange={vi.fn()} question={QUESTION_BANK_V1.work[3]} />);
  fireEvent.click(screen.getByRole('checkbox', { name: '被严格管理' }));
  expect(screen.getByRole('status').textContent).toContain('最多选择 3 项');

  rerender(<QuestionStep answer={{}} onChange={vi.fn()} question={QUESTION_BANK_V1.work[4]} />);
  expect(screen.getByRole('status').textContent).toBe('');
});

it('keeps the city separators a reader types', () => {
  const onChange = vi.fn();
  render(<QuestionStep answer={{ optionIds: ['city_q2_domestic'] }} onChange={onChange} question={QUESTION_BANK_V1.city[1]} />);

  const field = screen.getByLabelText('已经有考虑的城市？') as HTMLInputElement;
  fireEvent.change(field, { target: { value: '上海、成都' } });

  expect(field.value).toBe('上海、成都');
  expect(onChange).toHaveBeenCalledWith({ optionIds: ['city_q2_domestic'], supplementaryValue: ['上海', '成都'] });
});

it('shows how many choices are selected when a multi-select limit applies', () => {
  render(<QuestionStep answer={{ optionIds: ['city_q3_jobs'] }} onChange={vi.fn()} question={QUESTION_BANK_V1.city[2]} />);
  expect(screen.getByText('已选择 1 / 3 项')).toBeTruthy();
});

it('shows the explanatory line on questions that need one', () => {
  const { container, rerender } = render(<QuestionStep answer={{}} onChange={vi.fn()} question={QUESTION_BANK_V2.work[1]} />);
  expect(screen.getByText('回看做过的工作或学习任务，你更接近哪种感受？')).toBeTruthy();
  expect(container.querySelector('.question-description')?.textContent).toBe('按自己的实际体验选择；做得来，也可能不想长期做。');

  rerender(<QuestionStep answer={{}} onChange={vi.fn()} question={QUESTION_BANK_V2.work[2]} />);
  expect(container.querySelector('.question-description')?.textContent).toBe('可以参考工作、学习或生活中的具体体验；顺手不一定代表愿意长期做。');
});
