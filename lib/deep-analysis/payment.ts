import { createHmac, timingSafeEqual } from 'node:crypto';

import { DirectionIdSchema, type DirectionId } from './types';

const RECEIPT_TTL_MS = 30 * 60_000;

type ReceiptPayload = {
  version: 1;
  sessionId: string;
  directionId: DirectionId;
  paidAt: number;
  expiresAt: number;
};

export interface PaymentService {
  pay(input: { sessionId: string; directionId: DirectionId }): Promise<{ paidAt: number }>;
}

export const mockPaymentService: PaymentService = {
  async pay() {
    if (process.env.MOCK_PAYMENT_OUTCOME?.trim().toLowerCase() === 'failure') {
      throw new Error('mock_payment_failed');
    }
    return { paidAt: Date.now() };
  },
};

const sign = (encodedPayload: string, secret: string) =>
  createHmac('sha256', secret).update(encodedPayload).digest('base64url');

export function issuePaymentReceipt(
  input: { sessionId: string; directionId: DirectionId; paidAt: number },
  secret = process.env.MOCK_PAYMENT_SECRET ?? '',
): string {
  if (!secret) throw new Error('missing_payment_secret');
  const payload: ReceiptPayload = {
    version: 1,
    ...input,
    expiresAt: input.paidAt + RECEIPT_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyPaymentReceipt(
  receipt: string,
  expected: { sessionId: string; directionId: DirectionId; now?: number },
  secret = process.env.MOCK_PAYMENT_SECRET ?? '',
): { success: true; payload: ReceiptPayload } | { success: false } {
  try {
    if (!secret) return { success: false };
    const [encoded, signature, extra] = receipt.split('.');
    if (!encoded || !signature || extra) return { success: false };
    const actual = Buffer.from(signature);
    const wanted = Buffer.from(sign(encoded, secret));
    if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return { success: false };

    const value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<ReceiptPayload>;
    const direction = DirectionIdSchema.safeParse(value.directionId);
    if (
      value.version !== 1 ||
      typeof value.sessionId !== 'string' ||
      !direction.success ||
      typeof value.paidAt !== 'number' ||
      typeof value.expiresAt !== 'number' ||
      value.sessionId !== expected.sessionId ||
      direction.data !== expected.directionId ||
      (expected.now ?? Date.now()) > value.expiresAt
    ) return { success: false };

    return { success: true, payload: value as ReceiptPayload };
  } catch {
    return { success: false };
  }
}
