import { describe, expect, it, vi } from 'vitest';

import { createCareerValidationRepository } from './repository';
import type { CareerValidationSession } from './schema';

const id = '06e0dfdd-f521-43ab-b2b4-dcadf131c04d';
const childId = 'cbb486bd-aa1b-4774-b7fa-0d482e969eab';
const now = '2026-09-30T12:00:00.000Z';

function session(overrides: Partial<CareerValidationSession> = {}): CareerValidationSession {
  return {
    id, reportId: '941deece-021b-4d4b-b880-674d1af568f1', careerId: 'career-1-abc',
    parentValidationSessionId: null, status: 'created', validationContextSnapshot: null,
    experiment: null, experimentVersion: null, submission: null, reflection: null, result: null,
    generationMetadata: null, revision: 1, operationKind: null, operationToken: null,
    operationLeaseExpiresAt: null, capabilityIssuedAt: now, capabilityExpiresAt: '2026-10-30T12:00:00.000Z',
    retentionExpiresAt: '2027-03-29T12:00:00.000Z', createdAt: now, updatedAt: now, deletedAt: null,
    ...overrides,
  };
}

function toRow(value: CareerValidationSession): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), item]));
}

function fromRow(value: Record<string, unknown>): CareerValidationSession {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), item])) as CareerValidationSession;
}

function fakeDatabase() {
  const rows = new Map<string, Record<string, unknown>>();
  const rpc = vi.fn(async (operation: string, args: Record<string, unknown>) => {
    const raw = rows.get(String(args.p_id));
    const target = raw ? fromRow(raw) : undefined;
    if (operation === 'career_validation_claim_operation') {
      if (!target || target.status === 'deleted') return { data: { outcome: 'gone' }, error: null };
      if (target.operationToken && target.operationLeaseExpiresAt && target.operationLeaseExpiresAt > String(args.p_now)) {
        return { data: { outcome: 'in_progress', row: toRow(target) }, error: null };
      }
      const next = { ...target, status: args.p_kind === 'experiment' ? 'generating_experiment' : 'analyzing',
        operationKind: args.p_kind, operationToken: args.p_token,
        operationLeaseExpiresAt: new Date(Date.parse(String(args.p_now)) + Number(args.p_lease_seconds) * 1000).toISOString() } as CareerValidationSession;
      rows.set(next.id, toRow(next));
      return { data: { outcome: 'claimed', row: toRow(next) }, error: null };
    }
    if (operation === 'career_validation_complete_experiment') {
      if (!target || target.status === 'deleted' || target.operationToken !== args.p_token) return { data: null, error: null };
      const next = { ...target, status: 'ready', experiment: args.p_experiment, experimentVersion: 1,
        operationKind: null, operationToken: null, operationLeaseExpiresAt: null } as CareerValidationSession;
      rows.set(next.id, toRow(next));
      return { data: toRow(next), error: null };
    }
    if (operation === 'career_validation_patch') {
      if (!target || target.status === 'deleted') return { data: { outcome: 'gone' }, error: null };
      if (target.revision !== args.p_expected_revision) return { data: { outcome: 'conflict', latestRevision: target.revision }, error: null };
      const next = { ...target, ...(args.p_patch as object), revision: target.revision + 1 } as CareerValidationSession;
      rows.set(next.id, toRow(next));
      return { data: { outcome: 'updated', row: toRow(next) }, error: null };
    }
    if (operation === 'career_validation_erase') {
      if (!target) return { data: null, error: null };
      const next = { ...target, status: 'deleted', deletedAt: String(args.p_now), validationContextSnapshot: null,
        experiment: null, experimentVersion: null, submission: null, reflection: null, result: null, generationMetadata: null,
        operationKind: null, operationToken: null, operationLeaseExpiresAt: null } as CareerValidationSession;
      rows.set(next.id, toRow(next));
      return { data: toRow(next), error: null };
    }
    if (operation === 'career_validation_sweep_expired') {
      let erased = 0; let purged = 0;
      for (const rawRow of rows.values()) {
        const row = fromRow(rawRow);
        if (row.retentionExpiresAt <= String(args.p_now) && row.status !== 'deleted') {
          rows.set(row.id, toRow({ ...row, status: 'deleted', deletedAt: String(args.p_now), validationContextSnapshot: null,
            experiment: null, experimentVersion: null, submission: null, reflection: null, result: null, generationMetadata: null,
            operationKind: null, operationToken: null, operationLeaseExpiresAt: null }));
          erased += 1;
        } else if (row.status === 'deleted' && row.capabilityExpiresAt < new Date(Date.parse(String(args.p_now)) - 7 * 86400_000).toISOString()) {
          rows.delete(row.id); purged += 1;
        }
      }
      return { data: { erased, purged }, error: null };
    }
    return { data: null, error: new Error('unknown rpc') };
  });
  const from = vi.fn(() => ({
    select: () => ({ eq: (column: string, value: string) => ({ maybeSingle: async () => ({
      data: column === 'id' ? rows.get(value) ?? null : [...rows.values()].find((row) => row[column] === value) ?? null,
      error: null,
    }) }) }),
    insert: (value: Record<string, unknown>) => ({ select: () => ({ single: async () => {
      if (rows.has(String(value.id)) || (value.parent_validation_session_id && [...rows.values()].some((item) => item.parent_validation_session_id === value.parent_validation_session_id))) {
        return { data: null, error: { code: '23505' } };
      }
      rows.set(String(value.id), value); return { data: value, error: null };
    } }) }),
  }));
  return { rows, rpc, from };
}

describe('career validation repository', () => {
  it('returns the same initial row on a duplicate create', async () => {
    const db = fakeDatabase(); const repo = createCareerValidationRepository(db);
    const first = await repo.createInitial(session());
    const again = await repo.createInitial(session({ revision: 99 }));
    expect(first.revision).toBe(1);
    expect(again.revision).toBe(1);
    expect(db.rows.size).toBe(1);
  });

  it('prevents stale revision from overwriting saved content', async () => {
    const db = fakeDatabase(); const repo = createCareerValidationRepository(db);
    await repo.createInitial(session());
    const first = await repo.patch({ validationSessionId: id, expectedRevision: 1, patch: { status: 'in_progress' }, now });
    const stale = await repo.patch({ validationSessionId: id, expectedRevision: 1, patch: { status: 'submitted' }, now });
    expect(first).toMatchObject({ outcome: 'updated', session: { revision: 2 } });
    expect(stale).toEqual({ outcome: 'conflict', code: 'VERSION_CONFLICT', latestRevision: 2 });
    expect(db.rows.get(id)?.status).toBe('in_progress');
  });

  it('grants one lease, permits expiry takeover and rejects stale output', async () => {
    const db = fakeDatabase(); const repo = createCareerValidationRepository(db);
    await repo.createInitial(session());
    const claimed = await repo.claimOperation({ validationSessionId: id, kind: 'experiment', token: 'first-token', now, leaseSeconds: 10 });
    const concurrent = await repo.claimOperation({ validationSessionId: id, kind: 'experiment', token: 'second-token', now, leaseSeconds: 10 });
    expect(claimed.outcome).toBe('claimed');
    expect(concurrent.outcome).toBe('in_progress');
    const later = '2026-09-30T12:00:11.000Z';
    expect((await repo.claimOperation({ validationSessionId: id, kind: 'experiment', token: 'second-token', now: later, leaseSeconds: 10 })).outcome).toBe('claimed');
    expect(await repo.completeExperiment({ validationSessionId: id, token: 'first-token', experiment: null as never, now: later })).toBeNull();
    await repo.erase({ validationSessionId: id, now: later });
    expect(await repo.completeExperiment({ validationSessionId: id, token: 'second-token', experiment: null as never, now: later })).toBeNull();
  });

  it('keeps one child per parent and retains a tombstone until after token expiry', async () => {
    const db = fakeDatabase(); const repo = createCareerValidationRepository(db);
    await repo.createInitial(session());
    const child = session({ id: childId, parentValidationSessionId: id });
    expect((await repo.createChild(child)).id).toBe(childId);
    expect((await repo.createChild(session({ ...child, id: '82f5181a-6d8f-41d1-8b4e-9e9639bb4f3b' }))).id).toBe(childId);
    await repo.erase({ validationSessionId: id, now });
    expect(db.rows.get(id)?.validation_context_snapshot).toBeNull();
    expect(await repo.sweepExpired('2026-11-01T12:00:00.000Z', 100)).toEqual({ erased: 0, purged: 0 });
    expect(db.rows.has(id)).toBe(true);
    expect(await repo.sweepExpired('2026-11-08T12:00:01.000Z', 100)).toEqual({ erased: 0, purged: 1 });
    expect(db.rows.has(childId)).toBe(true);
  });
});
