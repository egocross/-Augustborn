import { DirectionIdSchema } from './types';
import type { PaymentOrder, PaymentOrderRepository } from './payment-orders';

type SupabaseLikeClient = {
  from(table: string): {
    insert(value: Record<string, unknown>): { select(): { single(): PromiseLike<{ data: unknown; error: unknown }> } };
    select(columns?: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> } };
    update(value: Record<string, unknown>): { eq(column: string, value: string): { select(): { single(): PromiseLike<{ data: unknown; error: unknown }> } } };
  };
};

type PaymentOrderRow = {
  id: string;
  out_trade_no: string;
  session_id: string;
  direction_id: string;
  amount: string | number;
  provider: string;
  status: string;
  paid_at: string | null;
  provider_trade_no: string | null;
};

function mapRow(value: unknown): PaymentOrder {
  const row = value as Partial<PaymentOrderRow>;
  const direction = DirectionIdSchema.safeParse(row.direction_id);
  if (
    !direction.success
    || typeof row.id !== 'string'
    || typeof row.out_trade_no !== 'string'
    || typeof row.session_id !== 'string'
    || (row.provider !== 'alipay_sandbox')
    || !['pending', 'paid', 'failed', 'expired'].includes(row.status ?? '')
  ) throw new Error('invalid_payment_order_row');
  return {
    id: row.id,
    outTradeNo: row.out_trade_no,
    sessionId: row.session_id,
    directionId: direction.data,
    amount: Number(row.amount).toFixed(2),
    provider: row.provider,
    status: row.status as PaymentOrder['status'],
    paidAt: row.paid_at ? new Date(row.paid_at).getTime() : null,
    providerTradeNo: row.provider_trade_no ?? null,
  };
}

export function createSupabasePaymentOrderRepository(clientValue: unknown): PaymentOrderRepository {
  const client = clientValue as SupabaseLikeClient;
  const requireRow = (result: { data: unknown; error: unknown }, code: string) => {
    if (result.error || !result.data) throw new Error(code);
    return mapRow(result.data);
  };
  return {
    async create(input) {
      const result = await client.from('payment_orders').insert({
        id: input.id,
        out_trade_no: input.outTradeNo,
        session_id: input.sessionId,
        direction_id: input.directionId,
        amount: input.amount,
        provider: input.provider,
        status: 'pending',
      }).select().single();
      return requireRow(result, 'payment_order_write_failed');
    },
    async findById(id) {
      const result = await client.from('payment_orders').select('*').eq('id', id).maybeSingle();
      if (result.error) throw new Error('payment_order_read_failed');
      return result.data ? mapRow(result.data) : null;
    },
    async findByOutTradeNo(outTradeNo) {
      const result = await client.from('payment_orders').select('*').eq('out_trade_no', outTradeNo).maybeSingle();
      if (result.error) throw new Error('payment_order_read_failed');
      return result.data ? mapRow(result.data) : null;
    },
    async markPaid(input) {
      const result = await client.from('payment_orders').update({
        status: 'paid',
        paid_at: new Date(input.paidAt).toISOString(),
        provider_trade_no: input.providerTradeNo,
        updated_at: new Date().toISOString(),
      }).eq('id', input.orderId).select().single();
      return requireRow(result, 'payment_order_update_failed');
    },
  };
}
