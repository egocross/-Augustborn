import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSupabaseAdmin, from, upsert } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(), from: vi.fn(), upsert: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin }));

import { persistDeepSession } from './persistence';

const event = {
  id: 'session-12345678', selectedDirection: 'work' as const, questionnaireVersion: 'v1' as const,
  answers: { work_q1: { optionIds: ['work_q1_student'] } }, optionalContext: '', customQuestion: null,
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
    expect(upsert).toHaveBeenCalledWith(expect.not.objectContaining({ birthInput: expect.anything(), freeReport: expect.anything() }));
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
