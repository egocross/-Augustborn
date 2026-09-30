import { describe, expect, it } from 'vitest';

import { authorizeValidationSession } from './authorize';
import { issueValidationCapability } from './capability';
import type { CareerValidationSession } from './schema';

const secret = 'the-test-secret-is-at-least-thirty-two-bytes-long';
const issuedAt = Date.parse('2026-10-01T00:00:00.000Z');
const id = '06e0dfdd-f521-43ab-b2b4-dcadf131c04d';
const reportId = '941deece-021b-4d4b-b880-674d1af568f1';
const careerId = 'career-1-a1b2c3';
const token = issueValidationCapability({ reportId, careerId, validationSessionId: id, issuedAt, ttlSeconds: 3600 }, secret);

function row(changes: Partial<CareerValidationSession> = {}): CareerValidationSession {
  return {
    id, reportId, careerId, parentValidationSessionId: null, status: 'created',
    validationContextSnapshot: null, experiment: null, experimentVersion: null,
    submission: null, reflection: null, result: null, generationMetadata: null, revision: 1,
    operationKind: null, operationToken: null, operationLeaseExpiresAt: null,
    capabilityIssuedAt: new Date(issuedAt).toISOString(), capabilityExpiresAt: new Date(issuedAt + 3_600_000).toISOString(),
    retentionExpiresAt: '2027-03-30T00:00:00.000Z', createdAt: new Date(issuedAt).toISOString(),
    updatedAt: new Date(issuedAt).toISOString(), deletedAt: null,
    ...changes,
  };
}

describe('validator API authorization boundary', () => {
  it('accepts only an exact active database binding', async () => {
    const session = row();
    const result = await authorizeValidationSession(token, id, { secret, now: issuedAt, repository: { get: async () => session } });
    expect(result).toBe(session);
  });

  it.each([
    ['report', { reportId: 'e04a6bc6-4fb7-4424-821f-2b0bfba95429' }],
    ['career', { careerId: 'career-other' }],
    ['issued time', { capabilityIssuedAt: '2026-10-01T00:00:01.000Z' }],
    ['expiry', { capabilityExpiresAt: '2026-10-01T02:00:00.000Z' }],
  ])('rejects database %s mismatch', async (_name, changes) => {
    await expect(authorizeValidationSession(token, id, {
      secret, now: issuedAt, repository: { get: async () => row(changes) },
    })).rejects.toMatchObject({ code: 'INVALID_CAPABILITY' });
  });

  it('distinguishes deleted, expired, missing and unavailable states', async () => {
    const activeRepository = { get: async () => row() };
    await expect(authorizeValidationSession(token, id, { secret, now: issuedAt, repository: { get: async () => row({ status: 'deleted', deletedAt: '2026-10-01T00:00:00.000Z' }) } }))
      .rejects.toMatchObject({ code: 'SESSION_GONE' });
    await expect(authorizeValidationSession(token, id, { secret, now: issuedAt, repository: { get: async () => null } }))
      .rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    await expect(authorizeValidationSession(token, id, { secret, now: issuedAt + 3_600_000, repository: activeRepository }))
      .rejects.toMatchObject({ code: 'CAPABILITY_EXPIRED' });
    await expect(authorizeValidationSession(token, id, { secret: '', now: issuedAt, repository: activeRepository }))
      .rejects.toMatchObject({ code: 'VALIDATION_UNAVAILABLE' });
  });
});
