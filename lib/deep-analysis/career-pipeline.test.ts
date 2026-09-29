import { describe, expect, it } from 'vitest';

import type { CareerCalibration } from './career-calibration';
import { createCareerAnalysisInput, createCareerResearchContext } from './career-pipeline';

const report = {
  disclaimer: '仅供参考',
  sections: [
    { heading: '工作方式', body: '偏好有清晰交付和反馈的任务。', bullets: ['适合内容策划与产品工作'] },
    { heading: '环境', body: '更适合小团队。', bullets: [] },
  ],
};

const calibration = (overrides: Partial<CareerCalibration['hardConstraints']> = {}): CareerCalibration => ({
  questionnaireVersion: 'career-v1',
  hardConstraints: {
    careerStatus: 'career_status_first_job', transitionUrgency: 'transition_3_months',
    income: { minimumIncomeBand: 'minimum_income_3000_5000', currency: 'CNY', salaryDropTolerance: 'salary_drop_none' },
    responsibilities: ['responsibility_none'],
    location: { mobility: 'mobility_nationwide', constraints: [] },
    transitionCapacity: {
      weeklyHours: 'weekly_hours_full_time', preparationHorizon: 'preparation_3_6_months',
      maxBudget: 'budget_1000_3000',
    },
    restartTolerance: 'restart_entry_level', educationTolerance: 'education_systematic_training',
    workConstraints: ['work_constraint_none'], incomeModels: ['income_model_any'],
    employmentTypes: ['employment_type_any'], ...overrides,
  },
  careerCapital: { experience: [], skills: ['capital_content'], evidence: [] },
  values: ['value_growth'],
});

describe('career analysis pipeline', () => {
  it('derives read-only base tendencies only from the completed base report', () => {
    const input = createCareerAnalysisInput(report, calibration());
    expect(input.baseTendencies.sections).toEqual(report.sections);
    expect(input.hardConstraints.careerStatus).toBe('career_status_first_job');
    expect(input.careerCapital.skills).toEqual(['capital_content']);
    expect(input.valuePreferences).toEqual(['value_growth']);
    expect(input.marketEvidence.status).toBe('unavailable');
  });

  it('keeps materially different reality profiles separate', () => {
    const mobileGraduate = createCareerAnalysisInput(report, calibration());
    const constrainedWorker = createCareerAnalysisInput(report, calibration({
      careerStatus: 'career_status_employed_switching',
      responsibilities: ['responsibility_family_expenses', 'responsibility_mortgage'],
      location: { mobility: 'mobility_fixed', constraints: ['location_constraint_family'] },
      transitionCapacity: {
        weeklyHours: 'weekly_hours_3_5', preparationHorizon: 'preparation_3_6_months',
        maxBudget: 'budget_1000_3000',
      },
    }));
    expect(mobileGraduate.hardConstraints.location.mobility).toBe('mobility_nationwide');
    expect(constrainedWorker.hardConstraints.location.mobility).toBe('mobility_fixed');
    expect(constrainedWorker.hardConstraints.responsibilities).toContain('responsibility_mortgage');
    expect(constrainedWorker).not.toEqual(mobileGraduate);
  });

  it('extracts only safe search labels, never report prose or raw private context', () => {
    const privateCalibration = calibration({
      careerStatusContext: 'private phone 13800000000',
      responsibilityContext: 'private family detail',
    });
    const context = createCareerResearchContext(createCareerAnalysisInput(report, privateCalibration));
    expect(context.keywords).toContain('内容创作');
    expect(JSON.stringify(context)).not.toContain('private');
    expect(JSON.stringify(context)).not.toContain('13800000000');
    expect(JSON.stringify(context)).not.toContain('偏好有清晰交付');
  });
});
