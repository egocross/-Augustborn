-- Career validation is independent of paid-report and payment retention.
create table if not exists public.career_validation_sessions (
  id uuid primary key,
  report_id text not null,
  career_id text not null,
  parent_validation_session_id uuid null references public.career_validation_sessions(id) on delete set null,
  status text not null check (status in (
    'created', 'generating_experiment', 'experiment_generation_failed', 'ready',
    'in_progress', 'submitted', 'analyzing', 'analysis_failed', 'completed',
    'persistence_degraded', 'capability_expired', 'deleted'
  )),
  validation_context_snapshot jsonb null,
  experiment jsonb null,
  experiment_version integer null,
  submission jsonb null,
  reflection jsonb null,
  result jsonb null,
  generation_metadata jsonb null,
  revision integer not null default 1 check (revision > 0),
  operation_kind text null check (operation_kind in ('experiment', 'analysis')),
  operation_token text null,
  operation_lease_expires_at timestamptz null,
  capability_issued_at timestamptz not null,
  capability_expires_at timestamptz not null,
  retention_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint career_validation_operation_fields_together check (
    (operation_kind is null and operation_token is null and operation_lease_expires_at is null)
    or (operation_kind is not null and operation_token is not null and operation_lease_expires_at is not null)
  )
);

create unique index if not exists career_validation_one_child_per_parent
  on public.career_validation_sessions(parent_validation_session_id)
  where parent_validation_session_id is not null;
create index if not exists career_validation_retention_idx
  on public.career_validation_sessions(retention_expires_at)
  where deleted_at is null;
create index if not exists career_validation_tombstone_idx
  on public.career_validation_sessions(capability_expires_at)
  where deleted_at is not null;

alter table public.career_validation_sessions enable row level security;
revoke all on public.career_validation_sessions from anon, authenticated;
grant all on public.career_validation_sessions to service_role;

create or replace function public.career_validation_guard_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.status = 'deleted' then
    raise exception 'career_validation_deleted_is_immutable';
  end if;
  if new.id is distinct from old.id or new.report_id is distinct from old.report_id
     or new.career_id is distinct from old.career_id
     or (new.parent_validation_session_id is distinct from old.parent_validation_session_id
         and not (old.parent_validation_session_id is not null and new.parent_validation_session_id is null))
     or new.capability_issued_at is distinct from old.capability_issued_at
     or new.capability_expires_at is distinct from old.capability_expires_at
     or new.retention_expires_at is distinct from old.retention_expires_at then
    raise exception 'career_validation_binding_is_immutable';
  end if;
  if new.status <> 'deleted' then
    if old.validation_context_snapshot is not null
       and new.validation_context_snapshot is distinct from old.validation_context_snapshot then
      raise exception 'career_validation_snapshot_is_immutable';
    end if;
    if old.experiment is not null and new.experiment is distinct from old.experiment then
      raise exception 'career_validation_experiment_is_immutable';
    end if;
    if old.result is not null and new.result is distinct from old.result then
      raise exception 'career_validation_result_is_immutable';
    end if;
    if old.status = 'completed' and (new.submission is distinct from old.submission
       or new.reflection is distinct from old.reflection) then
      raise exception 'career_validation_completed_is_immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists career_validation_guard_immutable_trigger on public.career_validation_sessions;
create trigger career_validation_guard_immutable_trigger before update on public.career_validation_sessions
  for each row execute function public.career_validation_guard_immutable();

create or replace function public.career_validation_claim_operation(
  p_id uuid, p_kind text, p_token text, p_now timestamptz, p_lease_seconds integer
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_row public.career_validation_sessions%rowtype;
begin
  if p_kind not in ('experiment', 'analysis') or p_token is null or length(p_token) < 8
     or p_lease_seconds <= 0 then
    raise exception 'invalid_career_validation_claim';
  end if;
  update public.career_validation_sessions
  set status = case when p_kind = 'experiment' then 'generating_experiment' else 'analyzing' end,
      operation_kind = p_kind, operation_token = p_token,
      operation_lease_expires_at = p_now + make_interval(secs => p_lease_seconds),
      revision = revision + 1, updated_at = p_now
  where id = p_id and deleted_at is null and retention_expires_at > p_now
    and (
      (p_kind = 'experiment' and (status in ('created', 'experiment_generation_failed')
        or (status = 'generating_experiment' and operation_lease_expires_at <= p_now)))
      or
      (p_kind = 'analysis' and (status in ('submitted', 'analysis_failed')
        or (status = 'analyzing' and operation_lease_expires_at <= p_now)))
    )
  returning * into v_row;
  if found then return jsonb_build_object('outcome', 'claimed', 'row', to_jsonb(v_row)); end if;

  select * into v_row from public.career_validation_sessions where id = p_id;
  if not found or v_row.deleted_at is not null or v_row.retention_expires_at <= p_now then
    return jsonb_build_object('outcome', 'gone');
  end if;
  if (p_kind = 'experiment' and v_row.experiment is not null)
     or (p_kind = 'analysis' and v_row.result is not null) then
    return jsonb_build_object('outcome', 'exists', 'row', to_jsonb(v_row));
  end if;
  if v_row.operation_kind = p_kind and v_row.operation_lease_expires_at > p_now then
    return jsonb_build_object('outcome', 'in_progress', 'row', to_jsonb(v_row));
  end if;
  return jsonb_build_object('outcome', 'invalid_state');
end;
$$;

create or replace function public.career_validation_complete_experiment(
  p_id uuid, p_token text, p_experiment jsonb, p_now timestamptz
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_row public.career_validation_sessions%rowtype;
begin
  update public.career_validation_sessions
  set experiment = p_experiment, experiment_version = (p_experiment->>'version')::integer,
      generation_metadata = coalesce(generation_metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'experimentGeneratorVersion', p_experiment#>>'{generationMetadata,experimentGeneratorVersion}',
          'experimentPromptVersion', p_experiment#>>'{generationMetadata,experimentPromptVersion}',
          'rubricVersion', p_experiment#>>'{generationMetadata,rubricVersion}',
          'experimentModelId', p_experiment#>>'{generationMetadata,experimentModelId}'
        ),
      status = 'ready', operation_kind = null, operation_token = null,
      operation_lease_expires_at = null, revision = revision + 1, updated_at = p_now
  where id = p_id and status = 'generating_experiment' and operation_kind = 'experiment'
    and operation_token = p_token and operation_lease_expires_at > p_now
    and retention_expires_at > p_now and deleted_at is null and experiment is null
  returning * into v_row;
  return case when found then to_jsonb(v_row) else null end;
end;
$$;

create or replace function public.career_validation_complete_analysis(
  p_id uuid, p_token text, p_result jsonb, p_now timestamptz
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_row public.career_validation_sessions%rowtype;
begin
  update public.career_validation_sessions
  set result = p_result,
      generation_metadata = coalesce(generation_metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'evaluationPromptVersion', p_result#>>'{generationMetadata,evaluationPromptVersion}',
          'rubricVersion', p_result#>>'{generationMetadata,rubricVersion}',
          'evaluationModelId', p_result#>>'{generationMetadata,evaluationModelId}'
        ),
      status = 'completed', operation_kind = null, operation_token = null,
      operation_lease_expires_at = null, revision = revision + 1, updated_at = p_now
  where id = p_id and status = 'analyzing' and operation_kind = 'analysis'
    and operation_token = p_token and operation_lease_expires_at > p_now
    and retention_expires_at > p_now and deleted_at is null and result is null
  returning * into v_row;
  return case when found then to_jsonb(v_row) else null end;
end;
$$;

create or replace function public.career_validation_fail_operation(
  p_id uuid, p_kind text, p_token text, p_now timestamptz
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_row public.career_validation_sessions%rowtype;
begin
  if p_kind not in ('experiment', 'analysis') then
    raise exception 'invalid_career_validation_operation';
  end if;
  update public.career_validation_sessions
  set status = case when p_kind = 'experiment' then 'experiment_generation_failed' else 'analysis_failed' end,
      operation_kind = null, operation_token = null, operation_lease_expires_at = null,
      revision = revision + 1, updated_at = p_now
  where id = p_id and operation_kind = p_kind and operation_token = p_token
    and status = case when p_kind = 'experiment' then 'generating_experiment' else 'analyzing' end
    and deleted_at is null and retention_expires_at > p_now
  returning * into v_row;
  return case when found then to_jsonb(v_row) else null end;
end;
$$;

create or replace function public.career_validation_patch(
  p_id uuid, p_expected_revision integer, p_patch jsonb, p_now timestamptz
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_row public.career_validation_sessions%rowtype;
begin
  if p_patch is null or p_patch - 'submission' - 'reflection' - 'status' <> '{}'::jsonb
     or (p_patch ? 'status' and p_patch->>'status' not in ('in_progress', 'submitted')) then
    raise exception 'invalid_career_validation_patch';
  end if;
  update public.career_validation_sessions
  set submission = case when p_patch ? 'submission' then p_patch->'submission' else submission end,
      reflection = case when p_patch ? 'reflection' then p_patch->'reflection' else reflection end,
      status = coalesce(p_patch->>'status', status), revision = revision + 1, updated_at = p_now
  where id = p_id and revision = p_expected_revision and deleted_at is null
    and retention_expires_at > p_now and status in ('ready', 'in_progress', 'submitted', 'analysis_failed')
  returning * into v_row;
  if found then return jsonb_build_object('outcome', 'updated', 'row', to_jsonb(v_row)); end if;
  select * into v_row from public.career_validation_sessions where id = p_id;
  if not found or v_row.deleted_at is not null or v_row.retention_expires_at <= p_now then
    return jsonb_build_object('outcome', 'gone');
  end if;
  if v_row.revision <> p_expected_revision then
    return jsonb_build_object('outcome', 'conflict', 'latestRevision', v_row.revision);
  end if;
  return jsonb_build_object('outcome', 'invalid_state');
end;
$$;

create or replace function public.career_validation_erase(p_id uuid, p_now timestamptz)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_row public.career_validation_sessions%rowtype;
begin
  update public.career_validation_sessions
  set status = 'deleted', deleted_at = p_now, validation_context_snapshot = null,
      experiment = null, experiment_version = null, submission = null, reflection = null,
      result = null, generation_metadata = null, operation_kind = null,
      operation_token = null, operation_lease_expires_at = null,
      revision = revision + 1, updated_at = p_now
  where id = p_id and deleted_at is null
  returning * into v_row;
  if found then return to_jsonb(v_row); end if;
  select * into v_row from public.career_validation_sessions where id = p_id;
  return case when found then to_jsonb(v_row) else null end;
end;
$$;

create or replace function public.career_validation_sweep_expired(p_now timestamptz, p_limit integer)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_id uuid; v_erased integer := 0; v_purged integer := 0;
begin
  if p_limit < 1 or p_limit > 1000 then raise exception 'invalid_career_validation_sweep_limit'; end if;
  for v_id in
    select id from public.career_validation_sessions
    where retention_expires_at <= p_now and deleted_at is null
    order by retention_expires_at limit p_limit for update skip locked
  loop
    perform public.career_validation_erase(v_id, p_now);
    v_erased := v_erased + 1;
  end loop;
  for v_id in
    select id from public.career_validation_sessions
    where deleted_at is not null and capability_expires_at + interval '7 days' <= p_now
    order by capability_expires_at limit p_limit for update skip locked
  loop
    delete from public.career_validation_sessions where id = v_id;
    v_purged := v_purged + 1;
  end loop;
  return jsonb_build_object('erased', v_erased, 'purged', v_purged);
end;
$$;

revoke all on function public.career_validation_guard_immutable() from public, anon, authenticated;
revoke all on function public.career_validation_claim_operation(uuid, text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.career_validation_complete_experiment(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.career_validation_complete_analysis(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.career_validation_patch(uuid, integer, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.career_validation_fail_operation(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.career_validation_erase(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.career_validation_sweep_expired(timestamptz, integer) from public, anon, authenticated;

grant execute on function public.career_validation_claim_operation(uuid, text, text, timestamptz, integer) to service_role;
grant execute on function public.career_validation_complete_experiment(uuid, text, jsonb, timestamptz) to service_role;
grant execute on function public.career_validation_complete_analysis(uuid, text, jsonb, timestamptz) to service_role;
grant execute on function public.career_validation_patch(uuid, integer, jsonb, timestamptz) to service_role;
grant execute on function public.career_validation_fail_operation(uuid, text, text, timestamptz) to service_role;
grant execute on function public.career_validation_erase(uuid, timestamptz) to service_role;
grant execute on function public.career_validation_sweep_expired(timestamptz, integer) to service_role;
