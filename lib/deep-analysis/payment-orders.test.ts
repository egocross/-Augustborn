import { describe, expect, it } from 'vitest';

import { createPaymentCoordinator, type PaymentOrder, type PaymentOrderRepository } from './payment-orders';

const order: PaymentOrder = {
  id: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
  outTradeNo: 'JV20260921ABC123',
  sessionId: 'session-12345678',
  directionId: 'city',
  amount: '29.90',
  provider: 'alipay_sandbox',
  status: 'pending',
  paidAt: null,
  providerTradeNo: null,
};

function repository(initial: PaymentOrder): PaymentOrderRepository {
  let current = initial;
  return {
    create: async () => current,
    findById: async (id) => current.id === id ? current : null,
    findByOutTradeNo: async (outTradeNo) => current.outTradeNo === outTradeNo ? current : null,
    markPaid: async ({ paidAt, providerTradeNo }) => {
      current = { ...current, status: 'paid', paidAt, providerTradeNo };
      return current;
    },
  };
}

describe('payment coordinator', () => {
  it('does not issue a report receipt while an order is pending', async () => {
    const coordinator = createPaymentCoordinator({
      repository: repository(order),
      provider: {
        createCheckout: async () => ({ status: 'pending', orderId: order.id, checkoutUrl: 'https://sandbox.example/pay' }),
        verifyNotification: () => ({ success: false }),
      },
      amount: '29.90',
      receiptSecret: 'test-payment-receipt-secret',
    });

    expect(await coordinator.getStatus({ orderId: order.id, sessionId: order.sessionId })).toEqual({ status: 'pending' });
  });

  it('marks a verified callback paid idempotently and then issues a bound receipt', async () => {
    const repo = repository(order);
    let verifyCalls = 0;
    const coordinator = createPaymentCoordinator({
      repository: repo,
      provider: {
        createCheckout: async () => ({ status: 'pending', orderId: order.id, checkoutUrl: 'https://sandbox.example/pay' }),
        verifyNotification: (_fields, expected) => {
          verifyCalls += 1;
          expect(expected).toEqual({ outTradeNo: order.outTradeNo, amount: order.amount });
          return { success: true, providerTradeNo: '2026092122000000001' };
        },
      },
      amount: '29.90',
      receiptSecret: 'test-payment-receipt-secret',
      now: () => 1_000_000,
    });

    expect(await coordinator.processNotification({ out_trade_no: order.outTradeNo })).toEqual({ success: true });
    expect(await coordinator.processNotification({ out_trade_no: order.outTradeNo })).toEqual({ success: true });
    expect(verifyCalls).toBe(1);
    const status = await coordinator.getStatus({ orderId: order.id, sessionId: order.sessionId });
    expect(status.status).toBe('paid');
    expect(status).toMatchObject({ receipt: expect.any(String) });
  });

  it('does not reveal an order or receipt to a different session', async () => {
    const coordinator = createPaymentCoordinator({
      repository: repository({ ...order, status: 'paid', paidAt: 1_000_000 }),
      provider: {
        createCheckout: async () => ({ status: 'pending', orderId: order.id, checkoutUrl: 'https://sandbox.example/pay' }),
        verifyNotification: () => ({ success: false }),
      },
      amount: '29.90',
      receiptSecret: 'test-payment-receipt-secret',
      now: () => 1_000_001,
    });

    expect(await coordinator.getStatus({ orderId: order.id, sessionId: 'session-attacker' })).toEqual({ status: 'not_found' });
  });
});
