import type { PaymentProvider } from './payment-orders';

export type AlipayGateway = {
  pageExecute(method: string, httpMethod: 'GET' | 'POST', options: unknown): string;
  checkNotifySignV2(fields: Record<string, string>): boolean;
};

export function createAlipayPaymentProvider(_config: {
  appId: string;
  sellerId: string;
  notifyUrl: string;
  returnUrl: string;
  gateway: AlipayGateway;
}): PaymentProvider {
  const config = _config;
  return {
    async createCheckout(input) {
      const returnUrl = new URL(config.returnUrl);
      returnUrl.searchParams.set('payment_order', input.orderId);
      const checkoutUrl = config.gateway.pageExecute('alipay.trade.wap.pay', 'GET', {
        bizContent: {
          out_trade_no: input.outTradeNo,
          product_code: 'QUICK_WAP_WAY',
          subject: input.subject,
          total_amount: input.amount,
          quit_url: returnUrl.toString(),
        },
        notifyUrl: config.notifyUrl,
        returnUrl: returnUrl.toString(),
      });
      return { status: 'pending', orderId: input.orderId, checkoutUrl };
    },
    verifyNotification(fields, expected) {
      if (!config.gateway.checkNotifySignV2(fields)) return { success: false };
      if (
        fields.app_id !== config.appId
        || fields.seller_id !== config.sellerId
        || fields.out_trade_no !== expected.outTradeNo
        || fields.total_amount !== expected.amount
        || !['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(fields.trade_status)
        || !fields.trade_no
      ) return { success: false };
      return { success: true, providerTradeNo: fields.trade_no };
    },
  };
}
