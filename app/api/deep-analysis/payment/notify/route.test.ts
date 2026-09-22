import { describe, expect, it, vi } from 'vitest';

import { createPaymentNotificationHandler } from './route';

describe('POST /api/deep-analysis/payment/notify', () => {
  it('acknowledges only a verified and persisted Alipay notification', async () => {
    const processNotification = vi.fn().mockResolvedValue({ success: true });
    const handler = createPaymentNotificationHandler({ processNotification });
    const response = await handler(new Request('https://example.com/api/deep-analysis/payment/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ out_trade_no: 'JV123', trade_status: 'TRADE_SUCCESS', sign: 'signed' }),
    }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('success');
    expect(processNotification).toHaveBeenCalledWith({
      out_trade_no: 'JV123', trade_status: 'TRADE_SUCCESS', sign: 'signed',
    });
  });

  it('returns failure so Alipay can retry an unverified notification', async () => {
    const handler = createPaymentNotificationHandler({
      processNotification: vi.fn().mockResolvedValue({ success: false }),
    });
    const response = await handler(new Request('https://example.com/api/deep-analysis/payment/notify', {
      method: 'POST',
      body: new URLSearchParams({ out_trade_no: 'JV123', sign: 'forged' }),
    }));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('failure');
  });
});
