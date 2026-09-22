import { describe, expect, it, vi } from 'vitest';

import { createSupabasePaymentOrderRepository } from './payment-repository';

describe('Supabase payment order repository', () => {
  it('stores only payment metadata and maps the persisted row back to an order', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
        out_trade_no: 'JV20260921ABC123',
        session_id: 'session-12345678',
        direction_id: 'city',
        amount: '29.90',
        provider: 'alipay_sandbox',
        status: 'pending',
        paid_at: null,
        provider_trade_no: null,
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = createSupabasePaymentOrderRepository({ from });

    const result = await repository.create({
      id: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
      outTradeNo: 'JV20260921ABC123',
      sessionId: 'session-12345678',
      directionId: 'city',
      amount: '29.90',
      provider: 'alipay_sandbox',
    });

    expect(insert).toHaveBeenCalledWith({
      id: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
      out_trade_no: 'JV20260921ABC123',
      session_id: 'session-12345678',
      direction_id: 'city',
      amount: '29.90',
      provider: 'alipay_sandbox',
      status: 'pending',
    });
    expect(result).toMatchObject({ status: 'pending', directionId: 'city', amount: '29.90' });
  });

  it('throws instead of treating a database failure as a successful payment', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: new Error('database unavailable') });
    const from = vi.fn().mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });
    const repository = createSupabasePaymentOrderRepository({ from });

    await expect(repository.create({
      id: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
      outTradeNo: 'JV20260921ABC123',
      sessionId: 'session-12345678',
      directionId: 'city',
      amount: '29.90',
      provider: 'alipay_sandbox',
    })).rejects.toThrow('payment_order_write_failed');
  });
});
