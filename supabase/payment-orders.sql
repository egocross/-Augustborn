create table if not exists public.payment_orders (
  id uuid primary key,
  out_trade_no text not null unique,
  session_id text not null,
  direction_id text not null check (direction_id in ('work', 'industry', 'city', 'collaboration', 'custom')),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'CNY',
  provider text not null check (provider in ('alipay_sandbox', 'alipay')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  provider_trade_no text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_orders_session_id_idx on public.payment_orders (session_id);

alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from anon, authenticated;
