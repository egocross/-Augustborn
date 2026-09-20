create table if not exists public.deep_report_sessions (
  id uuid primary key,
  selected_direction text not null,
  questionnaire_version text not null,
  answers jsonb not null default '{}'::jsonb,
  optional_context text,
  custom_question text,
  payment_status text not null,
  report_status text not null,
  report_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deep_report_sessions enable row level security;
revoke all on public.deep_report_sessions from anon, authenticated;
