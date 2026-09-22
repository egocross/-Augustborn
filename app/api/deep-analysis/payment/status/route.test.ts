import { describe, expect, it, vi } from 'vitest';

import { createPaymentStatusHandler } from './route';

const request = (body: unknown) => new Request('https://example.com/api/deep-analysis/payment/status', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('POST /api/deep-analysis/payment/status', () => {
  it('returns the receipt only after the server-side order is paid', async () => {
    const getStatus = vi.fn().mockResolvedValue({ status: 'paid', receipt: 'server-signed-receipt' });
    const handler = createPaymentStatusHandler({ getStatus });
    const response = await handler(request({
      orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
      sessionId: 'session-12345678',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'paid', receipt: 'server-signed-receipt' });
  });

  it('does not issue a receipt for a pending order', async () => {
    const handler = createPaymentStatusHandler({ getStatus: vi.fn().mockResolvedValue({ status: 'pending' }) });
    const response = await handler(request({
      orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
      sessionId: 'session-12345678',
    }));
    expect(await response.json()).toEqual({ status: 'pending' });
  });
});
