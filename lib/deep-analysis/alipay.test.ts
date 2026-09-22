import { describe, expect, it, vi } from 'vitest';

import { createAlipayPaymentProvider } from './alipay';

const baseConfig = {
  appId: '2026000000000000',
  sellerId: '2088000000000000',
  notifyUrl: 'https://pay.example.com/api/deep-analysis/payment/notify',
  returnUrl: 'https://pay.example.com/explore',
};

describe('Alipay sandbox provider', () => {
  it('creates a signed mobile-web checkout for the exact server-side order', async () => {
    const pageExecute = vi.fn().mockReturnValue('https://openapi-sandbox.dl.alipaydev.com/gateway.do?signed=1');
    const provider = createAlipayPaymentProvider({
      ...baseConfig,
      gateway: { pageExecute, checkNotifySignV2: vi.fn() },
    });

    const result = await provider.createCheckout({
      orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
      outTradeNo: 'JV20260921ABC123',
      amount: '29.90',
      subject: '个人专项深度分析',
    });

    expect(result).toEqual({
      status: 'pending',
      orderId: '07a6ec32-8a87-4e77-9f24-fd807084b8f6',
      checkoutUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do?signed=1',
    });
    expect(pageExecute).toHaveBeenCalledWith('alipay.trade.wap.pay', 'GET', {
      bizContent: {
        out_trade_no: 'JV20260921ABC123',
        product_code: 'QUICK_WAP_WAY',
        subject: '个人专项深度分析',
        total_amount: '29.90',
        quit_url: 'https://pay.example.com/explore?payment_order=07a6ec32-8a87-4e77-9f24-fd807084b8f6',
      },
      notifyUrl: baseConfig.notifyUrl,
      returnUrl: 'https://pay.example.com/explore?payment_order=07a6ec32-8a87-4e77-9f24-fd807084b8f6',
    });
  });

  it('rejects a signed notification when identity, amount, status, or order do not match', () => {
    const provider = createAlipayPaymentProvider({
      ...baseConfig,
      gateway: { pageExecute: vi.fn(), checkNotifySignV2: vi.fn().mockReturnValue(true) },
    });
    const notification = {
      app_id: baseConfig.appId,
      seller_id: baseConfig.sellerId,
      out_trade_no: 'JV20260921ABC123',
      trade_no: '2026092122000000001',
      total_amount: '29.90',
      trade_status: 'TRADE_SUCCESS',
      sign: 'signed',
      sign_type: 'RSA2',
    };
    const expected = { outTradeNo: 'JV20260921ABC123', amount: '29.90' };

    expect(provider.verifyNotification(notification, expected)).toEqual({
      success: true,
      providerTradeNo: '2026092122000000001',
    });
    expect(provider.verifyNotification({ ...notification, total_amount: '0.01' }, expected)).toEqual({ success: false });
    expect(provider.verifyNotification({ ...notification, app_id: 'another-app' }, expected)).toEqual({ success: false });
    expect(provider.verifyNotification({ ...notification, trade_status: 'WAIT_BUYER_PAY' }, expected)).toEqual({ success: false });
    expect(provider.verifyNotification({ ...notification, out_trade_no: 'another-order' }, expected)).toEqual({ success: false });
  });

  it('rejects a notification whose RSA2 signature is invalid', () => {
    const provider = createAlipayPaymentProvider({
      ...baseConfig,
      gateway: { pageExecute: vi.fn(), checkNotifySignV2: vi.fn().mockReturnValue(false) },
    });

    expect(provider.verifyNotification({
      app_id: baseConfig.appId,
      seller_id: baseConfig.sellerId,
      out_trade_no: 'JV20260921ABC123',
      trade_no: '2026092122000000001',
      total_amount: '29.90',
      trade_status: 'TRADE_SUCCESS',
      sign: 'forged',
      sign_type: 'RSA2',
    }, { outTradeNo: 'JV20260921ABC123', amount: '29.90' })).toEqual({ success: false });
  });
});
