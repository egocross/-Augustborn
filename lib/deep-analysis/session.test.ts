import { describe, expect, it } from 'vitest';

import { createInitialDeepState, deepFlowReducer, loadDeepSession, saveDeepSession } from './session';

const storage = () => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
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

  it('preserves the pending provider order before leaving for the cashier', () => {
    const paymentState = {
      ...createInitialDeepState('session-123'),
      selectedDirection: 'city' as const,
      step: 'payment' as const,
    };
    const next = deepFlowReducer(paymentState, {
      type: 'paymentStarted',
      orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
    });

    expect(next).toMatchObject({
      step: 'payment',
      paymentOrderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
      paymentReceipt: null,
    });
  });

  it('returns a failed custom-question request to the custom question step', () => {
    const loading = { ...createInitialDeepState('session-123'), step: 'custom-loading' as const, selectedDirection: 'custom' as const, customQuestion: '我要不要转岗？' };
    const next = deepFlowReducer(loading, { type: 'customQuestionsFailed', code: 'upstream_failed' });
    expect(next.step).toBe('custom-question');
    expect(next.customQuestion).toBe(loading.customQuestion);
  });

  it('normalizes transient restored steps into safe retry states', () => {
    const target = storage();
    const generating = {
      ...createInitialDeepState('session-123'),
      selectedDirection: 'work' as const,
      step: 'generating' as const,
      paymentReceipt: 'signed-receipt',
    };
    saveDeepSession(generating, target);
    expect(loadDeepSession(target)).toMatchObject({ step: 'payment', paymentReceipt: 'signed-receipt' });

    saveDeepSession({ ...generating, selectedDirection: 'custom', step: 'custom-loading', customQuestion: '是否转岗？' }, target);
    expect(loadDeepSession(target)).toMatchObject({ step: 'custom-question', customQuestion: '是否转岗？' });
  });

  it('resets semantically impossible restored states to direction selection', () => {
    const target = storage();
    saveDeepSession({ ...createInitialDeepState('session-123'), step: 'report' }, target);
    expect(loadDeepSession(target)).toMatchObject({ step: 'direction', selectedDirection: null, report: null });
  });
});
