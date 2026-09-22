import { z } from 'zod';

const StatusRequestSchema = z.object({
  orderId: z.string().uuid(),
  sessionId: z.string().min(8).max(100),
}).strict();

export function createPaymentStatusHandler(_dependencies: {
  getStatus: (input: { orderId: string; sessionId: string }) => Promise<unknown>;
}) {
  return async (request: Request) => {
    const parsed = StatusRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ code: 'invalid_input' }, { status: 400 });
    try {
      const result = await _dependencies.getStatus(parsed.data);
      return Response.json(result, { status: (result as { status?: string }).status === 'not_found' ? 404 : 200 });
    } catch {
      return Response.json({ code: 'payment_status_unavailable' }, { status: 503 });
    }
  };
}

export const POST = createPaymentStatusHandler({
  async getStatus(input) {
    const { getPaymentCoordinator } = await import('@/lib/deep-analysis/payment-runtime');
    return getPaymentCoordinator().getStatus(input);
  },
});
