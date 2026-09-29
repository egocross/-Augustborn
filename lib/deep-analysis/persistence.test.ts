import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSupabaseAdmin, from, upsert } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(), from: vi.fn(), upsert: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin }));

import { persistDeepSession } from './persistence';

const event = {
  id: 'session-12345678', selectedDirection: 'work' as const, questionnaireVersion: 'career-v1' as const,
  careerCalibration: {
    questionnaireVersion: 'career-v1' as const,
    hardConstraints: {
      careerStatus: 'career_status_first_job', transitionUrgency: 'transition_3_months',
      income: { minimumIncomeBand: 'minimum_income_3000_5000', currency: 'CNY' as const, salaryDropTolerance: 'salary_drop_none' },
      responsibilities: ['responsibility_none'], location: { mobility: 'mobility_nationwide', constraints: [] },
      transitionCapacity: { weeklyHours: 'weekly_hours_full_time', preparationHorizon: 'preparation_3_6_months', maxBudget: 'budget_none' },
      restartTolerance: 'restart_entry_level', educationTolerance: 'education_short', workConstraints: ['work_constraint_none'],
      incomeModels: ['income_model_any'], employmentTypes: ['employment_type_any'],
    },
    careerCapital: { experience: [], skills: [], evidence: [] }, values: ['value_growth'],
  },
  paymentStatus: 'paid' as const, reportStatus: 'generating' as const, reportResult: null,
};

beforeEach(() => {
  getSupabaseAdmin.mockReset(); from.mockReset(); upsert.mockReset();
  from.mockReturnValue({ upsert });
});

describe('persistDeepSession', () => {
  it('is non-blocking when Supabase is not configured', async () => {
    getSupabaseAdmin.mockReturnValue(null);
    await expect(persistDeepSession(event)).resolves.toEqual({ persisted: false });
  });

  it('writes only the approved structured fields', async () => {
    getSupabaseAdmin.mockReturnValue({ from });
    upsert.mockResolvedValue({ error: null });
    await expect(persistDeepSession(event)).resolves.toEqual({ persisted: true });
    expect(from).toHaveBeenCalledWith('deep_report_sessions');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      selected_direction: 'work', questionnaire_version: 'career-v1', answers: event.careerCalibration,
      optional_context: null, custom_question: null,
    }));
    expect(upsert).toHaveBeenCalledWith(expect.not.objectContaining({
      birthInput: expect.anything(), freeReport: expect.anything(), rawAnswers: expect.anything(),
    }));
  });

  it('returns false instead of rejecting on a write failure', async () => {
    getSupabaseAdmin.mockReturnValue({ from });
    upsert.mockRejectedValue(new Error('private connection detail'));
    await expect(persistDeepSession(event)).resolves.toEqual({ persisted: false });
  });

  it('returns false when creating the Supabase client throws', async () => {
    getSupabaseAdmin.mockImplementation(() => { throw new Error('invalid Supabase configuration'); });
    await expect(persistDeepSession(event)).resolves.toEqual({ persisted: false });
  });
});
