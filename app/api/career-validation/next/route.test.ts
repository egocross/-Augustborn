import { describe, expect, it, vi } from 'vitest';

import { NextValidationError } from '@/lib/career-validation/next-service';
import { createNextHandler } from './route';

const request = (body: unknown) => new Request('http://localhost/api/career-validation/next', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/career-validation/next', () => {
  it('only returns a child after an explicit user call', async () => {
    const createNext = vi.fn(async () => ({ validationSessionId: '123e4567-e89b-42d3-a456-426614174002', capability: 'child-token' }));
    const response = await createNextHandler({ createNext })(request({ capability: 'parent-token' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ validationSessionId: '123e4567-e89b-42d3-a456-426614174002', capability: 'child-token' });
    expect(createNext).toHaveBeenCalledOnce();
  });

  it('returns a stable refusal for real-world actions', async () => {
    const createNext = vi.fn(async () => { throw new NextValidationError('NEXT_ACTION_NOT_IN_PRODUCT'); });
    const response = await createNextHandler({ createNext })(request({ capability: 'parent-token' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: 'NEXT_ACTION_NOT_IN_PRODUCT' });
  });
});
