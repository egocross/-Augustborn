import { describe, expect, it, vi } from 'vitest';

import type { CareerValidationSession, ValidationResult } from '@/lib/career-validation/schema';
import { createAnalyzeHandler } from './route';

const request = () => new Request('http://localhost/api/career-validation/analyze', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ capability: 'signed-token' }),
});
const session = {
  id: '123e4567-e89b-42d3-a456-426614174001', status: 'submitted', result: null,
  submission: { content: '保留这份提交内容，不因分析失败而丢失。' }, reflection: { engagement: 'neutral' },
} as CareerValidationSession;

function fixture(outcome: 'claimed' | 'in_progress' | 'exists' = 'claimed') {
  const result = { status: 'insufficient_evidence' } as ValidationResult;
  const getSession = vi.fn(async () => session);
  const repository = {
    claimOperation: vi.fn(async () => ({ outcome, session: outcome === 'exists' ? { ...session, result } : session })),
    completeAnalysis: vi.fn(async () => ({ ...session, result })),
    failOperation: vi.fn(async () => ({ ...session, status: 'analysis_failed' as const })),
  };
  const analyze = vi.fn(async () => result);
  return { result, repository, analyze, dependencies: { getSession, repository, analyze, now: () => '2026-10-01T00:00:00.000Z', operationToken: () => 'operation-123' } };
}

describe('POST /api/career-validation/analyze', () => {
  it('stores the only lease holder result', async () => {
    const { dependencies, repository, result } = fixture();
    const response = await createAnalyzeHandler(dependencies)(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result });
    expect(repository.completeAnalysis).toHaveBeenCalledWith(expect.objectContaining({ token: 'operation-123', result }));
  });

  it('returns 202 during another operation and reuses completed results', async () => {
    const active = fixture('in_progress');
    expect((await createAnalyzeHandler(active.dependencies)(request())).status).toBe(202);
    expect(active.analyze).not.toHaveBeenCalled();
    const done = fixture('exists');
    expect(await (await createAnalyzeHandler(done.dependencies)(request())).json()).toEqual({ result: done.result });
    expect(done.analyze).not.toHaveBeenCalled();
  });

  it('marks failed analysis retryable without touching submission', async () => {
    const { dependencies, repository, analyze } = fixture();
    analyze.mockRejectedValueOnce(new Error('model failed'));
    const response = await createAnalyzeHandler(dependencies)(request());
    expect(response.status).toBe(503);
    expect(repository.failOperation).toHaveBeenCalledWith(expect.objectContaining({ kind: 'analysis', token: 'operation-123' }));
    expect(repository.completeAnalysis).not.toHaveBeenCalled();
  });

  it('rejects stale output after delete or lease expiry', async () => {
    const { dependencies, repository } = fixture();
    repository.completeAnalysis.mockResolvedValueOnce(null as never);
    expect((await createAnalyzeHandler(dependencies)(request())).status).toBe(410);
  });
});
