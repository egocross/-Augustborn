import { afterEach, describe, expect, it } from 'vitest';

import { issuePaymentReceipt, verifyPaymentReceipt } from './payment';

const secret = 'test-secret-with-enough-entropy';
const paidAt = 1_000_000;

afterEach(() => {
  delete process.env.PAYMENT_RECEIPT_SECRET;
  delete process.env.MOCK_PAYMENT_SECRET;
});

describe('payment receipts', () => {
  it('verifies a receipt bound to its session and direction', () => {
    const receipt = issuePaymentReceipt({ sessionId: 's1', directionId: 'work', paidAt }, secret);
    expect(verifyPaymentReceipt(receipt, { sessionId: 's1', directionId: 'work', now: paidAt + 1 }, secret).success).toBe(true);
  });

  it('rejects a valid receipt used for another direction', () => {
    const receipt = issuePaymentReceipt({ sessionId: 's1', directionId: 'work', paidAt }, secret);
    expect(verifyPaymentReceipt(receipt, { sessionId: 's1', directionId: 'city', now: paidAt + 1 }, secret).success).toBe(false);
  });

  it('rejects tampered and expired receipts', () => {
    const receipt = issuePaymentReceipt({ sessionId: 's1', directionId: 'work', paidAt }, secret);
    const expected = { sessionId: 's1', directionId: 'work' as const, now: paidAt + 1 };
    expect(verifyPaymentReceipt(`${receipt}x`, expected, secret).success).toBe(false);
    expect(verifyPaymentReceipt(receipt, { ...expected, now: paidAt + 31 * 60_000 }, secret).success).toBe(false);
  });

  it('uses the provider-neutral receipt secret for real payment providers', () => {
    process.env.PAYMENT_RECEIPT_SECRET = 'provider-neutral-secret';
    const receipt = issuePaymentReceipt({ sessionId: 's1', directionId: 'city', paidAt });
    expect(verifyPaymentReceipt(receipt, { sessionId: 's1', directionId: 'city', now: paidAt + 1 }).success).toBe(true);
  });
});
