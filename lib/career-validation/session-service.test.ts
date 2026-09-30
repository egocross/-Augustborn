import { describe, expect, it, vi } from 'vitest';

import type { CareerCalibration } from '@/lib/deep-analysis/career-calibration';
import { createSampleCareerReport } from '@/lib/report-provider/sample';
import { issueValidationCapability } from './capability';
import { careerIdForHypothesis } from './snapshot';
import { createOrRestoreSession } from './session-service';
import type { CareerValidationSession } from './schema';

const reportId = '123e4567-e89b-42d3-a456-426614174000';
const validationSessionId = '123e4567-e89b-42d3-a456-426614174001';
const secret = 'a-strong-secret-with-at-least-32-characters';
const now = Date.parse('2026-10-01T00:00:00.000Z');
const calibration: CareerCalibration = {
  questionnaireVersion: 'career-v1',
  hardConstraints: {
    careerStatus: 'career_status_first_job', transitionUrgency: 'transition_3_months',
    income: { minimumIncomeBand: 'minimum_income_3000_5000', currency: 'CNY', salaryDropTolerance: 'salary_drop_none' },
    responsibilities: ['responsibility_none'], location: { mobility: 'mobility_nationwide', constraints: [] },
    transitionCapacity: { weeklyHours: 'weekly_hours_full_time', preparationHorizon: 'preparation_3_6_months', maxBudget: 'budget_1000_3000' },
    restartTolerance: 'restart_entry_level', educationTolerance: 'education_systematic_training',
    workConstraints: ['work_constraint_none'], incomeModels: ['income_model_any'], employmentTypes: ['employment_type_any'],
  }, careerCapital: { experience: [], skills: [], evidence: [] }, values: ['value_growth'],
};
const report = createSampleCareerReport({ baseReport: { disclaimer: '参考', sections: [{ heading: 'a', body: 'b', bullets: [] }] }, careerCalibration: calibration, questionnaireVersion: 'career-v1' });
const careerId = careerIdForHypothesis(reportId, 0, report.careerHypotheses[0].title);
const token = issueValidationCapability({ reportId, careerId, validationSessionId, issuedAt: now, ttlSeconds: 3600 }, secret);

function fixture() {
  const sourceReport = structuredClone(report);
  let stored: CareerValidationSession | null = null;
  const repository = {
    get: vi.fn(async () => stored),
    createInitial: vi.fn(async (value: CareerValidationSession) => { stored ??= value; return stored; }),
  };
  const readReport = vi.fn(async () => ({ payment_status: 'paid', report_status: 'complete', report_result: sourceReport, answers: calibration, updated_at: '2026-09-30T12:00:00.000+00:00' }));
  const options = { repository, readReport, secret, now, retentionDays: 180 };
  return { options, repository, readReport, sourceReport, setStored: (value: CareerValidationSession | null) => { stored = value; } };
}

describe('create or restore validator', () => {
  it('freezes one career and returns the identical stored snapshot on retry', async () => {
    const { options, repository, readReport, sourceReport } = fixture();
    const first = await createOrRestoreSession(token, options);
    sourceReport.careerHypotheses[0].title = 'upstream changed';
    const second = await createOrRestoreSession(token, options);
    expect(first.id).toBe(validationSessionId);
    expect(first.validationContextSnapshot?.career.careerId).toBe(careerId);
    expect(second.validationContextSnapshot).toEqual(first.validationContextSnapshot);
    expect(repository.createInitial).toHaveBeenCalledTimes(1);
    expect(readReport).toHaveBeenCalledTimes(1);
  });

  it.each(['unpaid', 'incomplete'])('rejects %s paid report state', async (state) => {
    const { options, readReport } = fixture();
    readReport.mockResolvedValueOnce({ payment_status: state === 'unpaid' ? 'unpaid' : 'paid', report_status: state === 'incomplete' ? 'generating' : 'complete', report_result: report, answers: calibration, updated_at: '2026-09-30T12:00:00.000Z' });
    await expect(createOrRestoreSession(token, options)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });

  it('rejects a changed career and deleted session', async () => {
    const { options, setStored } = fixture();
    const session = await createOrRestoreSession(token, options);
    setStored({ ...session, status: 'deleted', deletedAt: new Date(now).toISOString() });
    await expect(createOrRestoreSession(token, options)).rejects.toMatchObject({ code: 'SESSION_GONE' });
    setStored(session);
    const forged = issueValidationCapability({ reportId, careerId: 'other-career', validationSessionId, issuedAt: now, ttlSeconds: 3600 }, secret);
    await expect(createOrRestoreSession(forged, options)).rejects.toMatchObject({ code: 'INVALID_CAPABILITY' });
  });
});
