import { describe, expect, it } from 'vitest';

import type { CareerDraftAnswers } from './career-calibration';
import {
  normalizeCareerCalibration,
  summarizeCareerCalibration,
  validateCareerDraft,
} from './career-calibration';

const validDraft = (overrides: CareerDraftAnswers = {}): CareerDraftAnswers => ({
  career_status: { optionIds: ['career_status_first_job'] },
  transition_urgency: { optionIds: ['transition_3_months'] },
  minimum_income: { optionIds: ['minimum_income_3000_5000'] },
  salary_drop_tolerance: { optionIds: ['salary_drop_20'] },
  income_runway: { optionIds: ['runway_1_3_months'] },
  responsibilities: { optionIds: ['responsibility_none'] },
  location_mobility: { optionIds: ['mobility_nationwide'] },
  weekly_hours: { optionIds: ['weekly_hours_full_time'] },
  preparation_horizon: { optionIds: ['preparation_3_6_months'] },
  max_budget: { optionIds: ['budget_1000_3000'] },
  career_capital: { optionIds: ['capital_none'] },
  restart_tolerance: { optionIds: ['restart_entry_level'] },
  education_tolerance: { optionIds: ['education_systematic_training'] },
  work_constraints: { optionIds: ['work_constraint_none'] },
  income_models: { optionIds: ['income_model_any'] },
  employment_types: { optionIds: ['employment_type_any'] },
  career_values: { optionIds: ['value_growth', 'value_income_stability'] },
  ...overrides,
});

describe('career draft validation', () => {
  it('rejects incomplete and unknown answers', () => {
    expect(validateCareerDraft({}).valid).toBe(false);
    expect(validateCareerDraft(validDraft({ unknown_question: { optionIds: ['unknown'] } }))).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([expect.objectContaining({ questionId: 'unknown_question' })]),
    });
  });

  it('rejects over-limit and mutually exclusive selections', () => {
    expect(validateCareerDraft(validDraft({
      career_values: { optionIds: ['value_income', 'value_growth', 'value_time_freedom', 'value_impact'] },
    })).valid).toBe(false);
    expect(validateCareerDraft(validDraft({
      responsibilities: { optionIds: ['responsibility_none', 'responsibility_family_expenses'] },
    })).valid).toBe(false);
  });

  it('requires a valid custom RMB minimum when custom income is selected', () => {
    expect(validateCareerDraft(validDraft({
      minimum_income: { optionIds: ['minimum_income_custom'], numericValue: 8_500 },
    })).valid).toBe(true);
    expect(validateCareerDraft(validDraft({
      minimum_income: { optionIds: ['minimum_income_custom'], numericValue: -1 },
    })).valid).toBe(false);
    expect(validateCareerDraft(validDraft({
      minimum_income: { optionIds: ['minimum_income_custom'], numericValue: 10_000_001 },
    })).valid).toBe(false);
  });

  it('rejects answers to questions that are currently hidden', () => {
    expect(validateCareerDraft(validDraft({
      salary_drop_tolerance: { optionIds: ['salary_drop_none'] },
      income_runway: { optionIds: ['runway_6_12_months'] },
    }))).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([expect.objectContaining({ questionId: 'income_runway' })]),
    });
  });
});

describe('career calibration normalization', () => {
  it('separates hard constraints, career capital, and value preferences', () => {
    const normalized = normalizeCareerCalibration(validDraft({
      career_capital: {
        optionIds: ['capital_industry_experience', 'capital_programming', 'capital_portfolio'],
      },
    }));

    expect(normalized).toMatchObject({
      questionnaireVersion: 'career-v1',
      hardConstraints: {
        careerStatus: 'career_status_first_job',
        transitionUrgency: 'transition_3_months',
        income: {
          minimumIncomeBand: 'minimum_income_3000_5000',
          salaryDropTolerance: 'salary_drop_20',
          runway: 'runway_1_3_months',
        },
      },
      careerCapital: {
        experience: ['capital_industry_experience'],
        skills: ['capital_programming'],
        evidence: ['capital_portfolio'],
      },
      values: ['value_growth', 'value_income_stability'],
    });
  });

  it('keeps custom minimum income as a bounded numeric value', () => {
    expect(normalizeCareerCalibration(validDraft({
      minimum_income: { optionIds: ['minimum_income_custom'], numericValue: 8_500 },
    })).hardConstraints.income).toMatchObject({
      minimumIncomeBand: 'minimum_income_custom',
      minimumIncomeCustom: 8_500,
      currency: 'CNY',
    });
  });

  it.each([
    ['A', validDraft(), 'career_status_first_job'],
    ['B', validDraft({
      career_status: { optionIds: ['career_status_employed_switching'] },
      responsibilities: { optionIds: ['responsibility_family_expenses', 'responsibility_mortgage'] },
      location_mobility: { optionIds: ['mobility_fixed'] },
      location_constraints: { optionIds: ['location_constraint_family', 'location_constraint_property'] },
      weekly_hours: { optionIds: ['weekly_hours_3_5'] },
      restart_tolerance: { optionIds: ['restart_one_level'] },
      career_capital: { optionIds: ['capital_industry_experience', 'capital_project_experience'] },
    }), 'career_status_employed_switching'],
    ['C', validDraft({
      career_status: { optionIds: ['career_status_unemployed'] },
      transition_urgency: { optionIds: ['transition_3_months'] },
      income_runway: { optionIds: ['runway_less_than_month'] },
    }), 'career_status_unemployed'],
    ['D', validDraft({
      career_status: { optionIds: ['career_status_freelance'] },
      location_mobility: { optionIds: ['mobility_remote'] },
      income_models: { optionIds: ['income_model_project', 'income_model_multiple'] },
      employment_types: { optionIds: ['employment_type_freelance', 'employment_type_project'] },
      career_values: { optionIds: ['value_personal_assets', 'value_location_freedom'] },
    }), 'career_status_freelance'],
  ])('normalizes reference case %s without collapsing its profile', (_caseName, draft, expectedStatus) => {
    const normalized = normalizeCareerCalibration(draft);

    expect(normalized.hardConstraints.careerStatus).toBe(expectedStatus);
    expect(normalized.careerCapital).toBeDefined();
    expect(normalized.values.length).toBeGreaterThan(0);
  });

  it('summarizes only explicit answers using neutral range language', () => {
    const summary = summarizeCareerCalibration(normalizeCareerCalibration(validDraft()));

    expect(summary).toEqual(expect.arrayContaining([
      '希望在 3 个月内开始进入新方向',
      '最低可接受月收入为 3000–5000 元',
      '目前可全职投入转型',
    ]));
    expect(summary.join(' ')).not.toMatch(/适合|一定|应该|最优/);
  });
});
