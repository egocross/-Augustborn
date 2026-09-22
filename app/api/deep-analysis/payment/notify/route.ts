export function createPaymentNotificationHandler(_dependencies: {
  processNotification: (fields: Record<string, string>) => Promise<{ success: boolean }>;
}) {
  return async (request: Request) => {
    try {
      const form = await request.formData();
      const fields = Object.fromEntries(
        [...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      );
      const result = await _dependencies.processNotification(fields);
      return new Response(result.success ? 'success' : 'failure', {
        status: result.success ? 200 : 400,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    } catch {
      return new Response('failure', { status: 400 });
    }
  };
}

export const POST = createPaymentNotificationHandler({
  async processNotification(fields) {
    const { getPaymentCoordinator } = await import('@/lib/deep-analysis/payment-runtime');
    return getPaymentCoordinator().processNotification(fields);
  },
});
