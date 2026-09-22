import type { DirectionId } from './types';
import { issuePaymentReceipt } from './payment';

export const PAYMENT_PROVIDER_IDS = ['alipay_sandbox', 'alipay'] as const;

export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export type PaymentOrder = {
  id: string;
  outTradeNo: string;
  sessionId: string;
  directionId: DirectionId;
  amount: string;
  provider: PaymentProviderId;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  paidAt: number | null;
  providerTradeNo: string | null;
};

export type PaymentOrderRepository = {
  create(input: Omit<PaymentOrder, 'status' | 'paidAt' | 'providerTradeNo'>): Promise<PaymentOrder>;
  findById(id: string): Promise<PaymentOrder | null>;
  findByOutTradeNo(outTradeNo: string): Promise<PaymentOrder | null>;
  markPaid(input: { orderId: string; paidAt: number; providerTradeNo: string }): Promise<PaymentOrder>;
};

export type PaymentProvider = {
  createCheckout(input: { orderId: string; outTradeNo: string; amount: string; subject: string }): Promise<{
    status: 'pending'; orderId: string; checkoutUrl: string;
  }>;
  verifyNotification(
    fields: Record<string, string>,
    expected: { outTradeNo: string; amount: string },
  ): { success: true; providerTradeNo: string } | { success: false };
};

export function createPaymentCoordinator(_config: {
  repository: PaymentOrderRepository;
  provider: PaymentProvider;
  providerId?: PaymentProviderId;
  amount: string;
  receiptSecret: string;
  now?: () => number;
}) {
  const config = { providerId: 'alipay_sandbox' as PaymentProviderId, ..._config, now: _config.now ?? Date.now };
  return {
    async createCheckout(input: { sessionId: string; directionId: DirectionId }) {
      const id = crypto.randomUUID();
      const outTradeNo = `JV${config.now()}${id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
      const order = await config.repository.create({
        id,
        outTradeNo,
        sessionId: input.sessionId,
        directionId: input.directionId,
        amount: config.amount,
        provider: config.providerId,
      });
      return config.provider.createCheckout({
        orderId: order.id,
        outTradeNo: order.outTradeNo,
        amount: order.amount,
        subject: '个人专项深度分析',
      });
    },
    async processNotification(fields: Record<string, string>) {
      const outTradeNo = fields.out_trade_no;
      if (!outTradeNo) return { success: false as const };
      const order = await config.repository.findByOutTradeNo(outTradeNo);
      if (!order) return { success: false as const };
      if (order.status === 'paid') return { success: true as const };
      const verified = config.provider.verifyNotification(fields, {
        outTradeNo: order.outTradeNo,
        amount: order.amount,
      });
      if (!verified.success) return { success: false as const };
      await config.repository.markPaid({
        orderId: order.id,
        paidAt: config.now(),
        providerTradeNo: verified.providerTradeNo,
      });
      return { success: true as const };
    },
    async getStatus(input: { orderId: string; sessionId: string }) {
      const order = await config.repository.findById(input.orderId);
      if (!order || order.sessionId !== input.sessionId) return { status: 'not_found' as const };
      if (order.status !== 'paid' || order.paidAt === null) return { status: order.status };
      return {
        status: 'paid' as const,
        receipt: issuePaymentReceipt({
          sessionId: order.sessionId,
          directionId: order.directionId,
          paidAt: order.paidAt,
        }, config.receiptSecret),
      };
    },
  };
}
