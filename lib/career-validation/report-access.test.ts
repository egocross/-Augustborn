import { describe, expect, it } from 'vitest';

import { createSampleCareerReport } from '@/lib/report-provider/sample';
import type { CareerCalibration } from '@/lib/deep-analysis/career-calibration';
import { careerIdForHypothesis } from './snapshot';
import { createInitialValidationAccess } from './report-access';

const reportId = '123e4567-e89b-42d3-a456-426614174000';
const secret = 'a-strong-secret-with-at-least-32-characters';
const calibration: CareerCalibration = {
  questionnaireVersion: 'career-v1', hardConstraints: {
    careerStatus: 'career_status_first_job', transitionUrgency: 'transition_3_months',
    income: { minimumIncomeBand: 'minimum_income_3000_5000', currency: 'CNY', salaryDropTolerance: 'salary_drop_none' },
    responsibilities: ['responsibility_none'], location: { mobility: 'mobility_nationwide', constraints: [] },
    transitionCapacity: { weeklyHours: 'weekly_hours_full_time', preparationHorizon: 'preparation_3_6_months', maxBudget: 'budget_1000_3000' },
    restartTolerance: 'restart_entry_level', educationTolerance: 'education_systematic_training',
    workConstraints: ['work_constraint_none'], incomeModels: ['income_model_any'], employmentTypes: ['employment_type_any'],
  }, careerCapital: { experience: [], skills: [], evidence: [] }, values: ['value_growth'],
};

describe('initial validation access', () => {
  it('is absent without confirmed persistence or a valid UUID report ID', () => {
    const report = createSampleCareerReport({ baseReport: { disclaimer: '参考', sections: [{ heading: 'a', body: 'b', bullets: [] }] }, careerCalibration: calibration, questionnaireVersion: 'career-v1' });
    expect(createInitialValidationAccess({ reportId, report, persisted: false, issuedAt: 1000, ttlSeconds: 300, secret })).toEqual([]);
    expect(createInitialValidationAccess({ reportId: 'session-12345678', report, persisted: true, issuedAt: 1000, ttlSeconds: 300, secret })).toEqual([]);
  });

  it('distinguishes duplicate career titles by report position', () => {
    const report = createSampleCareerReport({ baseReport: { disclaimer: '参考', sections: [{ heading: 'a', body: 'b', bullets: [] }] }, careerCalibration: calibration, questionnaireVersion: 'career-v1' });
    report.careerHypotheses[1].title = report.careerHypotheses[0].title;
    const access = createInitialValidationAccess({ reportId, report, persisted: true, issuedAt: 1000, ttlSeconds: 300, secret });
    expect(access).toHaveLength(report.careerHypotheses.length);
    expect(access[0].careerId).toBe(careerIdForHypothesis(reportId, 0, report.careerHypotheses[0].title));
    expect(access[1].careerId).not.toBe(access[0].careerId);
    expect(access.every((item) => item.validationSessionId && item.capability)).toBe(true);
  });
});
