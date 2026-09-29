import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCareerQuestion } from '@/lib/deep-analysis/career-calibration-questions';
import { CareerCalibrationQuestion } from './career-calibration-question';

afterEach(() => cleanup());

describe('CareerCalibrationQuestion', () => {
  it('uses fieldset/legend and a non-color selected mark', () => {
    const question = getCareerQuestion('career_values')!;
    const onChange = vi.fn();
    const { rerender } = render(
      <CareerCalibrationQuestion answer={{ optionIds: [] }} onChange={onChange} question={question} />,
    );

    expect(screen.getByRole('group', { name: question.question })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('长期成长'));
    expect(onChange).toHaveBeenLastCalledWith({ optionIds: ['value_growth'] });

    rerender(
      <CareerCalibrationQuestion
        answer={{ optionIds: ['value_growth'] }}
        onChange={onChange}
        question={question}
      />,
    );
    expect(screen.getByText('✓ 已选择')).toBeTruthy();
  });

  it('announces and enforces the configured multi-select limit', () => {
    const question = getCareerQuestion('career_values')!;
    const onChange = vi.fn();
    render(
      <CareerCalibrationQuestion
        answer={{ optionIds: ['value_income', 'value_growth', 'value_balance'] }}
        onChange={onChange}
        question={question}
      />,
    );

    fireEvent.click(screen.getByLabelText('影响力'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('最多选择 3 项');
  });

  it('renders keyboard-accessible custom amount and other-text fields', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CareerCalibrationQuestion
        answer={{ optionIds: ['minimum_income_custom'] }}
        onChange={onChange}
        question={getCareerQuestion('minimum_income')!}
      />,
    );

    const amount = screen.getByLabelText('最低月收入（人民币）');
    expect(amount.getAttribute('inputmode')).toBe('numeric');
    fireEvent.change(amount, { target: { value: '8500' } });
    expect(onChange).toHaveBeenLastCalledWith({ optionIds: ['minimum_income_custom'], numericValue: 8500 });

    rerender(
      <CareerCalibrationQuestion
        answer={{ optionIds: ['responsibility_other'] }}
        onChange={onChange}
        question={getCareerQuestion('responsibilities')!}
      />,
    );
    fireEvent.change(screen.getByLabelText('还有哪些现实情况会限制你的职业选择？'), {
      target: { value: '需要固定时间照护家人' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      optionIds: ['responsibility_other'], textValue: '需要固定时间照护家人',
    });
  });
});
