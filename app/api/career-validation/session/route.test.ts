import { describe, expect, it, vi } from 'vitest';

import { ValidationAccessError } from '@/lib/career-validation/authorize';
import { ValidationDraftError } from '@/lib/career-validation/draft-service';
import { createSessionHandler, createSessionPatchHandler, createSessionDeleteHandler } from './route';

const request = (body: unknown) => new Request('http://localhost/api/career-validation/session', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('DELETE /api/career-validation/session', () => {
  it('erases only the bound validation session', async () => {
    const getSession = vi.fn(async () => ({ id: '123e4567-e89b-42d3-a456-426614174001' }));
    const erase = vi.fn(async () => ({ status: 'deleted' }));
    const DELETE = createSessionDeleteHandler({ getSession, erase });
    const response = await DELETE(new Request('http://localhost/api/career-validation/session', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ capability: 'signed-token' }),
    }));
    expect(response.status).toBe(200);
    expect(erase).toHaveBeenCalledWith('123e4567-e89b-42d3-a456-426614174001');
    expect(await response.json()).toEqual({ deleted: true });
  });
});

describe('PATCH /api/career-validation/session', () => {
  it('returns 409 and latest revision on a stale edit', async () => {
    const save = vi.fn(async () => { throw new ValidationDraftError('VERSION_CONFLICT', 4); });
    const PATCH = createSessionPatchHandler({ save });
    const response = await PATCH(new Request('http://localhost/api/career-validation/session', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capability: 'signed-token', expectedRevision: 2, patch: { status: 'in_progress' } }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: 'VERSION_CONFLICT', latestRevision: 4 });
  });

  it('rejects client attempts to edit the frozen snapshot', async () => {
    const save = vi.fn();
    const PATCH = createSessionPatchHandler({ save });
    const response = await PATCH(new Request('http://localhost/api/career-validation/session', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capability: 'signed-token', expectedRevision: 2, patch: { validationContextSnapshot: {} } }),
    }));
    expect(response.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('POST /api/career-validation/session', () => {
  it('returns frozen session projection without payment or source report', async () => {
    const createOrRestore = vi.fn(async () => ({ id: 'session', revision: 1, validationContextSnapshot: { contextHash: 'hash' } }));
    const response = await createSessionHandler({ createOrRestore })(request({ capability: 'signed-token' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ session: { id: 'session', revision: 1, validationContextSnapshot: { contextHash: 'hash' } } });
    expect(createOrRestore).toHaveBeenCalledWith('signed-token');
  });

  it('rejects extra input and does not reach the service', async () => {
    const createOrRestore = vi.fn();
    const response = await createSessionHandler({ createOrRestore })(request({ capability: 'signed-token', report: {} }));
    expect(response.status).toBe(400);
    expect(createOrRestore).not.toHaveBeenCalled();
  });

  it('maps a deleted session to 410', async () => {
    const createOrRestore = vi.fn(async () => { throw new ValidationAccessError('SESSION_GONE'); });
    const response = await createSessionHandler({ createOrRestore })(request({ capability: 'signed-token' }));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ code: 'SESSION_GONE' });
  });
});
