import { afterEach, describe, expect, it } from 'vitest';

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
    const response = await POST(request({ sessionId: 'session-12345678', directionId: 'city' }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: 'paid', receipt: expect.any(String), price: '¥29.90' });
  });

  it('returns payment_failed when failure simulation is enabled', async () => {
    process.env.MOCK_PAYMENT_SECRET = 'route-secret';
    process.env.MOCK_PAYMENT_OUTCOME = 'failure';
    const response = await POST(request({ sessionId: 'session-12345678', directionId: 'work' }));
    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ code: 'payment_failed', error: expect.any(String) });
  });

  it('rejects invalid input without issuing a receipt', async () => {
    process.env.MOCK_PAYMENT_SECRET = 'route-secret';
    const response = await POST(request({ sessionId: 'x', directionId: 'unknown' }));
    expect(response.status).toBe(400);
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

    const response = await handler(request({ sessionId: 'session-12345678', directionId: 'city' }));
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
      body: JSON.stringify({ sessionId: 'session-12345678', directionId: 'city' }),
    }));

    expect(response.status).toBe(200);
    expect(received).toEqual([{
      input: { sessionId: 'session-12345678', directionId: 'city' },
      origin: 'http://localhost:3000',
    }]);
  });
});
