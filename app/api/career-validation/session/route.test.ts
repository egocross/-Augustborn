import { describe, expect, it, vi } from 'vitest';

import { ValidationAccessError } from '@/lib/career-validation/authorize';
import { createSessionHandler } from './route';

const request = (body: unknown) => new Request('http://localhost/api/career-validation/session', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
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
