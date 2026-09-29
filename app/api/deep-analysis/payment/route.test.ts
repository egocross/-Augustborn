import { afterEach, describe, expect, it, vi } from 'vitest';

import { verifyPaymentReceipt } from '@/lib/deep-analysis/payment';
import { createPaymentHandler, POST } from './route';

const request = (body: unknown) => new Request('http://localhost/api/deep-analysis/payment', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

afterEach(() => {
  delete process.env.MOCK_PAYMENT_SECRET;
  delete process.env.MOCK_PAYMENT_OUTCOME;
  delete process.env.DEEP_REPORT_PRICE;
  delete process.env.PAYMENT_PROVIDER;
  delete process.env.PAYMENT_RECEIPT_SECRET;
});

describe('POST /api/deep-analysis/payment', () => {
  it('returns a signed paid receipt and configured price', async () => {
    process.env.MOCK_PAYMENT_SECRET = 'route-secret';
    process.env.DEEP_REPORT_PRICE = '¥29.90';
    const response = await POST(request({ sessionId: 'session-12345678' }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: 'paid', receipt: expect.any(String), price: '¥29.90' });
    expect(verifyPaymentReceipt(payload.receipt, {
      sessionId: 'session-12345678', directionId: 'work',
    }).success).toBe(true);
  });

  it('returns payment_failed when failure simulation is enabled', async () => {
    process.env.MOCK_PAYMENT_SECRET = 'route-secret';
    process.env.MOCK_PAYMENT_OUTCOME = 'failure';
    const response = await POST(request({ sessionId: 'session-12345678' }));
    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ code: 'payment_failed', error: expect.any(String) });
  });

  it('rejects invalid input without issuing a receipt', async () => {
    process.env.MOCK_PAYMENT_SECRET = 'route-secret';
    const response = await POST(request({ sessionId: 'x' }));
    expect(response.status).toBe(400);
  });

  it.each(['work', 'industry', 'city', 'collaboration', 'custom'])(
    'rejects client-supplied legacy direction %s before checkout',
    async (directionId) => {
      const createSandboxCheckout = vi.fn();
      const handler = createPaymentHandler({ createSandboxCheckout });
      const response = await handler(request({ sessionId: 'session-12345678', directionId }));
      expect(response.status).toBe(400);
      expect(createSandboxCheckout).not.toHaveBeenCalled();
    },
  );

  it('rejects unknown fields before checkout', async () => {
    const createSandboxCheckout = vi.fn();
    const handler = createPaymentHandler({ createSandboxCheckout });
    const response = await handler(request({ sessionId: 'session-12345678', coupon: 'free' }));
    expect(response.status).toBe(400);
    expect(createSandboxCheckout).not.toHaveBeenCalled();
  });

  it('returns a pending sandbox checkout instead of unlocking the report', async () => {
    process.env.PAYMENT_PROVIDER = 'alipay_sandbox';
    const handler = createPaymentHandler({
      createSandboxCheckout: async () => ({
        status: 'pending',
        orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
        checkoutUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do?signed=1',
      }),
    });

    const response = await handler(request({ sessionId: 'session-12345678' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'pending',
      orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
      checkoutUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do?signed=1',
      price: '¥29.90',
    });
  });

  it('forwards the requesting browser origin so the return leg stays on that site', async () => {
    process.env.PAYMENT_PROVIDER = 'alipay_sandbox';
    const received: Array<{ input: unknown; origin: string | null }> = [];
    const handler = createPaymentHandler({
      createSandboxCheckout: async (input, request) => {
        received.push({ input, origin: request.headers.get('origin') });
        return {
          status: 'pending' as const,
          orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
          checkoutUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do?signed=1',
        };
      },
    });

    const response = await handler(new Request('http://localhost/api/deep-analysis/payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ sessionId: 'session-12345678' }),
    }));

    expect(response.status).toBe(200);
    expect(received).toEqual([{
      input: { sessionId: 'session-12345678', directionId: 'work' },
      origin: 'http://localhost:3000',
    }]);
  });
});
