import { z } from 'zod';

import { issuePaymentReceipt, mockPaymentService } from '@/lib/deep-analysis/payment';
import { CAREER_DIRECTION_ID } from '@/lib/deep-analysis/types';

const PaymentRequestSchema = z.object({
  sessionId: z.string().min(8).max(100),
}).strict();

const bindCareerDirection = (input: z.infer<typeof PaymentRequestSchema>) => ({
  ...input,
  directionId: CAREER_DIRECTION_ID,
});
type CareerPaymentInput = ReturnType<typeof bindCareerDirection>;

type SandboxCheckout = {
  status: 'pending';
  orderId: string;
  checkoutUrl: string;
};

export function createPaymentHandler(_dependencies: {
  createSandboxCheckout: (
    input: CareerPaymentInput,
    request: Request,
  ) => Promise<SandboxCheckout>;
}) {
  return async (request: Request) => {
    const parsed = PaymentRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ code: 'invalid_input', error: '支付信息无效。' }, { status: 400 });
    }
    try {
      const checkout = await _dependencies.createSandboxCheckout(bindCareerDirection(parsed.data), request);
      return Response.json({
        ...checkout,
        price: process.env.DEEP_REPORT_PRICE?.trim() || '¥29.90',
      });
    } catch {
      return Response.json({ code: 'payment_failed', error: '支付服务暂时不可用。' }, { status: 503 });
    }
  };
}

async function handleMockPayment(request: Request) {
  const parsed = PaymentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ code: 'invalid_input', error: '支付信息无效。' }, { status: 400 });
  }

  if (!process.env.MOCK_PAYMENT_SECRET) {
    return Response.json({ code: 'payment_failed', error: '支付服务尚未配置。' }, { status: 503 });
  }

  try {
    const paymentInput = bindCareerDirection(parsed.data);
    const { paidAt } = await mockPaymentService.pay(paymentInput);
    return Response.json({
      status: 'paid',
      receipt: issuePaymentReceipt({ ...paymentInput, paidAt }),
      price: process.env.DEEP_REPORT_PRICE?.trim() || '¥29.90',
    });
  } catch {
    return Response.json({ code: 'payment_failed', error: '本次模拟支付未完成，请重试。' }, { status: 402 });
  }
}

const handleSandboxPayment = createPaymentHandler({
  async createSandboxCheckout(input, request) {
    const { getPaymentCoordinator } = await import('@/lib/deep-analysis/payment-runtime');
    return getPaymentCoordinator({ browserOrigin: request.headers.get('origin') }).createCheckout(input);
  },
});

export async function POST(request: Request) {
  return process.env.PAYMENT_PROVIDER?.trim().toLowerCase() === 'alipay_sandbox'
    ? handleSandboxPayment(request)
    : handleMockPayment(request);
}
