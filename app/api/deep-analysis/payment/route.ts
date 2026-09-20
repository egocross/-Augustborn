import { z } from 'zod';

import { issuePaymentReceipt, mockPaymentService } from '@/lib/deep-analysis/payment';
import { DirectionIdSchema } from '@/lib/deep-analysis/types';

const PaymentRequestSchema = z.object({
  sessionId: z.string().min(8).max(100),
  directionId: DirectionIdSchema,
}).strict();

export async function POST(request: Request) {
  const parsed = PaymentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ code: 'invalid_input', error: '支付信息无效。' }, { status: 400 });
  }

  if (!process.env.MOCK_PAYMENT_SECRET) {
    return Response.json({ code: 'payment_failed', error: '支付服务尚未配置。' }, { status: 503 });
  }

  try {
    const { paidAt } = await mockPaymentService.pay(parsed.data);
    return Response.json({
      status: 'paid',
      receipt: issuePaymentReceipt({ ...parsed.data, paidAt }),
      price: process.env.DEEP_REPORT_PRICE?.trim() || '¥29.90',
    });
  } catch {
    return Response.json({ code: 'payment_failed', error: '本次模拟支付未完成，请重试。' }, { status: 402 });
  }
}
