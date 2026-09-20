import { afterEach, describe, expect, it } from 'vitest';

import { POST } from './route';

const request = (body: unknown) => new Request('http://localhost/api/deep-analysis/payment', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

afterEach(() => {
  delete process.env.MOCK_PAYMENT_SECRET;
  delete process.env.MOCK_PAYMENT_OUTCOME;
  delete process.env.DEEP_REPORT_PRICE;
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
});
