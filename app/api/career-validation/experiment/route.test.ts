import { describe, expect, it, vi } from 'vitest';

import type { CareerExperiment, CareerValidationSession } from '@/lib/career-validation/schema';
import { createExperimentHandler } from './route';

const request = () => new Request('http://localhost/api/career-validation/experiment', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ capability: 'signed-token' }),
});
const session = { id: '123e4567-e89b-42d3-a456-426614174001', experiment: null } as CareerValidationSession;

function fixture(outcome: 'claimed' | 'in_progress' | 'exists' = 'claimed') {
  const experiment = { id: 'experiment-1' } as CareerExperiment;
  const getSession = vi.fn(async () => session);
  const repository = {
    claimOperation: vi.fn(async () => ({ outcome, session: outcome === 'exists' ? { ...session, experiment } : session })),
    completeExperiment: vi.fn(async () => ({ ...session, experiment })),
  };
  const generate = vi.fn(async () => experiment);
  return { experiment, getSession, repository, generate, dependencies: { getSession, repository, generate, now: () => '2026-10-01T00:00:00.000Z', operationToken: () => 'operation-123' } };
}

describe('POST /api/career-validation/experiment', () => {
  it('only the lease holder generates and freezes an experiment', async () => {
    const { dependencies, repository, generate, experiment } = fixture();
    const response = await createExperimentHandler(dependencies)(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ experiment });
    expect(repository.claimOperation).toHaveBeenCalledWith(expect.objectContaining({ validationSessionId: session.id, token: 'operation-123' }));
    expect(generate).toHaveBeenCalledTimes(1);
    expect(repository.completeExperiment).toHaveBeenCalledWith(expect.objectContaining({ token: 'operation-123', experiment }));
  });

  it('returns 202 during another active lease without a second model call', async () => {
    const { dependencies, generate } = fixture('in_progress');
    const response = await createExperimentHandler(dependencies)(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ code: 'OPERATION_IN_PROGRESS' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns frozen content on retry and never regenerates', async () => {
    const { dependencies, generate, experiment } = fixture('exists');
    const response = await createExperimentHandler(dependencies)(request());
    expect(await response.json()).toEqual({ experiment });
    expect(generate).not.toHaveBeenCalled();
  });

  it('does not deliver stale output after deletion or lease replacement', async () => {
    const { dependencies, repository } = fixture();
    repository.completeExperiment.mockResolvedValueOnce(null as never);
    const response = await createExperimentHandler(dependencies)(request());
    expect(response.status).toBe(410);
  });
});
