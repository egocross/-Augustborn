import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { QUESTION_BANK_V1 } from '@/lib/deep-analysis/questions';
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
  render(<QuestionStep answer={{}} onChange={onChange} question={QUESTION_BANK_V1.work[0]} />);
  fireEvent.click(screen.getByRole('radio', { name: '学生' }));
  expect(onChange).toHaveBeenCalledWith({ optionIds: ['work_q1_student'] });
});

it('uses a compact option layout only when a question has at least seven choices', () => {
  const { container, rerender } = render(<QuestionStep answer={{}} onChange={vi.fn()} question={QUESTION_BANK_V1.work[0]} />);
  expect(container.querySelector('.option-grid')?.getAttribute('data-layout')).toBe('compact');

  rerender(<QuestionStep answer={{}} onChange={vi.fn()} question={QUESTION_BANK_V1.city[0]} />);
  expect(container.querySelector('.option-grid')?.getAttribute('data-layout')).toBe('standard');
});

it('shows how many choices are selected when a multi-select limit applies', () => {
  render(<QuestionStep answer={{ optionIds: ['city_q3_jobs'] }} onChange={vi.fn()} question={QUESTION_BANK_V1.city[2]} />);
  expect(screen.getByText('已选择 1 / 3 项')).toBeTruthy();
});
