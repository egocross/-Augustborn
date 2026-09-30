import { describe, expect, it, vi } from 'vitest';

import { createRetentionHandler } from './route';

describe('GET /api/career-validation/retention', () => {
  const sweep = vi.fn(async () => ({ erased: 2, purged: 1 }));
  const GET = createRetentionHandler({ sweep, secret: 'cron-secret' });

  it.each([null, 'Bearer wrong', 'cron-secret'])('rejects wrong bearer %s', async (authorization) => {
    sweep.mockClear();
    const response = await GET(new Request('http://localhost/api/career-validation/retention', { headers: authorization ? { authorization } : {} }));
    expect(response.status).toBe(401);
    expect(sweep).not.toHaveBeenCalled();
  });

  it('sweeps only when authorized', async () => {
    const response = await GET(new Request('http://localhost/api/career-validation/retention', { headers: { authorization: 'Bearer cron-secret' } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ erased: 2, purged: 1 });
  });
});
