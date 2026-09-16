create extension if not exists pgcrypto;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  rating smallint not null check (rating between 1 and 5),
  wants_deep_analysis boolean not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
