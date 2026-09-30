import { describe, expect, it, vi } from 'vitest';

import { sweepCareerValidationSessions } from './retention';

describe('validator retention', () => {
  it('runs a bounded independent content/tombstone sweep', async () => {
    const repository = { sweepExpired: vi.fn(async () => ({ erased: 2, purged: 1 })) };
    const result = await sweepCareerValidationSessions(new Date('2026-10-01T00:00:00.000Z'), { repository, batchSize: 100 });
    expect(result).toEqual({ erased: 2, purged: 1 });
    expect(repository.sweepExpired).toHaveBeenCalledWith('2026-10-01T00:00:00.000Z', 100);
    expect(repository.sweepExpired).toHaveBeenCalledOnce();
  });
});
