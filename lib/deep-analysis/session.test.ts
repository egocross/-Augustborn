import { describe, expect, it } from 'vitest';

import { createInitialDeepState, deepFlowReducer, loadDeepSession, saveDeepSession } from './session';

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } as Storage;
};

describe('deep flow session', () => {
  it('discards corrupt and incompatible session data', () => {
    const target = storage();
    target.setItem('jianvia.deep-analysis', '{bad');
    expect(loadDeepSession(target)).toBeNull();
    target.setItem('jianvia.deep-analysis', JSON.stringify({ version: 0, state: {} }));
    expect(loadDeepSession(target)).toBeNull();
  });

  it('round-trips a versioned state', () => {
    const target = storage();
    const state = { ...createInitialDeepState('session-123'), selectedDirection: 'city' as const, step: 'questions' as const };
    saveDeepSession(state, target);
    expect(loadDeepSession(target)).toMatchObject({ sessionId: 'session-123', selectedDirection: 'city', step: 'questions' });
  });

  it('preserves answers and paid receipt when generation fails', () => {
    const paidState = {
      ...createInitialDeepState('session-123'), step: 'generating' as const,
      answers: { work_q1: { optionIds: ['work_q1_student'] } }, paymentReceipt: 'signed-receipt',
    };
    const next = deepFlowReducer(paidState, { type: 'generationFailed', code: 'timeout' });
    expect(next.answers).toEqual(paidState.answers);
    expect(next.paymentReceipt).toBe(paidState.paymentReceipt);
    expect(next.step).toBe('payment');
  });
});
