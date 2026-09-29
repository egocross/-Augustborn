import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import type { CareerCalibration } from '@/lib/deep-analysis/career-calibration';
import { CareerCalibrationSummary } from './career-calibration-summary';

afterEach(() => cleanup());

const calibration: CareerCalibration = {
  questionnaireVersion: 'career-v1',
  hardConstraints: {
    careerStatus: 'career_status_employed_switching',
    transitionUrgency: 'transition_3_months',
    income: {
      minimumIncomeBand: 'minimum_income_8000_12000', currency: 'CNY',
      salaryDropTolerance: 'salary_drop_20', runway: 'runway_1_3_months',
    },
    responsibilities: ['responsibility_family_expenses'],
    location: { mobility: 'mobility_fixed', constraints: ['location_constraint_family'] },
    transitionCapacity: {
      weeklyHours: 'weekly_hours_5_10', preparationHorizon: 'preparation_3_6_months',
      maxBudget: 'budget_1000_3000',
    },
    restartTolerance: 'restart_one_level',
    educationTolerance: 'education_short',
    workConstraints: ['work_constraint_overtime'],
    incomeModels: ['income_model_salary'],
    employmentTypes: ['employment_type_full_time'],
  },
  careerCapital: { experience: ['capital_industry_experience'], skills: [], evidence: [] },
  values: ['value_income_stability', 'value_growth'],
};

it('shows only confirmed facts and exposes edit/confirm actions', () => {
  const onEdit = vi.fn();
  const onConfirm = vi.fn();
  render(<CareerCalibrationSummary calibration={calibration} onConfirm={onConfirm} onEdit={onEdit} />);

  expect(screen.getByRole('heading', { name: '现实条件摘要' })).toBeTruthy();
  expect(screen.getByText('最低可接受月收入为 8000–12000 元')).toBeTruthy();
  expect(screen.queryByText(/最适合|一定会|命中注定/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '返回修改' }));
  fireEvent.click(screen.getByRole('button', { name: '确认并继续' }));
  expect(onEdit).toHaveBeenCalledOnce();
  expect(onConfirm).toHaveBeenCalledOnce();
});
