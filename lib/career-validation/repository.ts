import 'server-only';

import { CareerValidationSessionSchema, type CareerExperiment, type CareerValidationSession, type Reflection, type Submission, type ValidationResult } from './schema';

type QueryResult = { data: unknown; error: unknown };
type Client = {
  from(table: string): {
    select(columns?: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<QueryResult> } };
    insert(value: Record<string, unknown>): { select(): { single(): PromiseLike<QueryResult> } };
  };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResult>;
};

function toRow(value: CareerValidationSession): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), item,
  ]));
}

function fromRow(value: unknown): CareerValidationSession {
  if (!value || typeof value !== 'object') throw new Error('invalid_career_validation_row');
  const mapped = Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), item,
  ]));
  return CareerValidationSessionSchema.parse(mapped);
}

function assertResult(result: QueryResult, code: string): unknown {
  if (result.error) throw new Error(code);
  return result.data;
}

function outcome(result: QueryResult, code: string): Record<string, unknown> {
  const value = assertResult(result, code);
  if (!value || typeof value !== 'object') throw new Error(code);
  return value as Record<string, unknown>;
}

export type RepositoryClaim =
  | { outcome: 'claimed'; session: CareerValidationSession }
  | { outcome: 'in_progress'; session: CareerValidationSession }
  | { outcome: 'exists'; session: CareerValidationSession }
  | { outcome: 'gone' }
  | { outcome: 'invalid_state' };

export type RepositoryPatch =
  | { outcome: 'updated'; session: CareerValidationSession }
  | { outcome: 'conflict'; code: 'VERSION_CONFLICT'; latestRevision: number }
  | { outcome: 'gone' | 'invalid_state' };

export type ValidationDraftPatch = {
  submission?: Submission | null;
  reflection?: Reflection | null;
  status?: 'in_progress' | 'submitted';
};

export type CareerValidationRepository = ReturnType<typeof createCareerValidationRepository>;

export function createCareerValidationRepository(clientValue: unknown) {
  const client = clientValue as Client;
  async function get(validationSessionId: string): Promise<CareerValidationSession | null> {
    const result = await client.from('career_validation_sessions').select('*').eq('id', validationSessionId).maybeSingle();
    const value = assertResult(result, 'career_validation_read_failed');
    return value ? fromRow(value) : null;
  }

  async function insertOrRecover(input: CareerValidationSession, conflictColumn: 'id' | 'parent_validation_session_id') {
    const result = await client.from('career_validation_sessions').insert(toRow(input)).select().single();
    if (!result.error && result.data) return fromRow(result.data);
    const conflict = result.error as { code?: string } | null;
    if (conflict?.code !== '23505') throw new Error('career_validation_write_failed');
    const conflictValue = conflictColumn === 'id' ? input.id : input.parentValidationSessionId;
    if (!conflictValue) throw new Error('career_validation_write_failed');
    const existing = await client.from('career_validation_sessions').select('*').eq(conflictColumn, conflictValue).maybeSingle();
    const recovered = assertResult(existing, 'career_validation_read_failed');
    if (!recovered) throw new Error('career_validation_conflict_unresolved');
    return fromRow(recovered);
  }

  return {
    get,
    createInitial: (input: CareerValidationSession) => insertOrRecover(input, 'id'),
    createChild: (input: CareerValidationSession) => insertOrRecover(input, 'parent_validation_session_id'),
    async claimOperation(input: { validationSessionId: string; kind: 'experiment' | 'analysis'; token: string; now: string; leaseSeconds: number }): Promise<RepositoryClaim> {
      const data = outcome(await client.rpc('career_validation_claim_operation', {
        p_id: input.validationSessionId, p_kind: input.kind, p_token: input.token,
        p_now: input.now, p_lease_seconds: input.leaseSeconds,
      }), 'career_validation_claim_failed');
      if (data.outcome === 'gone' || data.outcome === 'invalid_state') return { outcome: data.outcome };
      if (data.outcome === 'claimed' || data.outcome === 'in_progress' || data.outcome === 'exists') {
        return { outcome: data.outcome, session: fromRow(data.row) };
      }
      throw new Error('invalid_career_validation_claim');
    },
    async completeExperiment(input: { validationSessionId: string; token: string; experiment: CareerExperiment; now: string }): Promise<CareerValidationSession | null> {
      const data = assertResult(await client.rpc('career_validation_complete_experiment', {
        p_id: input.validationSessionId, p_token: input.token, p_experiment: input.experiment, p_now: input.now,
      }), 'career_validation_experiment_write_failed');
      return data ? fromRow(data) : null;
    },
    async completeAnalysis(input: { validationSessionId: string; token: string; result: ValidationResult; now: string }): Promise<CareerValidationSession | null> {
      const data = assertResult(await client.rpc('career_validation_complete_analysis', {
        p_id: input.validationSessionId, p_token: input.token, p_result: input.result, p_now: input.now,
      }), 'career_validation_result_write_failed');
      return data ? fromRow(data) : null;
    },
    async patch(input: { validationSessionId: string; expectedRevision: number; patch: ValidationDraftPatch; now: string }): Promise<RepositoryPatch> {
      const data = outcome(await client.rpc('career_validation_patch', {
        p_id: input.validationSessionId, p_expected_revision: input.expectedRevision,
        p_patch: input.patch, p_now: input.now,
      }), 'career_validation_patch_failed');
      if (data.outcome === 'updated') return { outcome: 'updated', session: fromRow(data.row) };
      if (data.outcome === 'conflict' && typeof data.latestRevision === 'number') {
        return { outcome: 'conflict', code: 'VERSION_CONFLICT', latestRevision: data.latestRevision };
      }
      if (data.outcome === 'gone' || data.outcome === 'invalid_state') return { outcome: data.outcome };
      throw new Error('invalid_career_validation_patch');
    },
    async erase(input: { validationSessionId: string; now: string }): Promise<CareerValidationSession | null> {
      const data = assertResult(await client.rpc('career_validation_erase', {
        p_id: input.validationSessionId, p_now: input.now,
      }), 'career_validation_erase_failed');
      return data ? fromRow(data) : null;
    },
    async sweepExpired(now: string, limit: number): Promise<{ erased: number; purged: number }> {
      const data = outcome(await client.rpc('career_validation_sweep_expired', {
        p_now: now, p_limit: limit,
      }), 'career_validation_sweep_failed');
      if (!Number.isInteger(data.erased) || !Number.isInteger(data.purged)) throw new Error('invalid_career_validation_sweep');
      return { erased: data.erased as number, purged: data.purged as number };
    },
  };
}
