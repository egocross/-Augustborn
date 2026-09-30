import { describe, expect, it } from 'vitest';

import { issueValidationCapability, reconstructValidationCapability, verifyValidationCapability } from './capability';
import type { CareerValidationSession } from './schema';

const secret = 'the-test-secret-is-at-least-thirty-two-bytes-long';
const issuedAt = Date.parse('2026-10-01T00:00:00.000Z');
const input = {
  reportId: '941deece-021b-4d4b-b880-674d1af568f1',
  careerId: 'career-1-a1b2c3',
  validationSessionId: '06e0dfdd-f521-43ab-b2b4-dcadf131c04d',
  issuedAt,
  ttlSeconds: 3600,
};

function mutatePayload(token: string, changes: Record<string, unknown>): string {
  const [encoded, signature] = token.split('.');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  return `${Buffer.from(JSON.stringify({ ...payload, ...changes })).toString('base64url')}.${signature}`;
}

describe('career validation capability', () => {
  it('binds report, career, session, scope and exact expiry', () => {
    const token = issueValidationCapability(input, secret);
    expect(verifyValidationCapability(token, input.validationSessionId, secret, issuedAt)).toMatchObject({
      version: 1, scope: 'career_validation', reportId: input.reportId,
      careerId: input.careerId, validationSessionId: input.validationSessionId,
      issuedAt, expiresAt: issuedAt + 3_600_000,
    });
    expect(verifyValidationCapability(token, 'cbb486bd-aa1b-4774-b7fa-0d482e969eab', secret, issuedAt)).toBeNull();
    expect(verifyValidationCapability(token, input.validationSessionId, secret, issuedAt + 3_600_000)).toBeNull();
  });

  it.each([
    ['report', { reportId: 'e04a6bc6-4fb7-4424-821f-2b0bfba95429' }],
    ['career', { careerId: 'career-other' }],
    ['session', { validationSessionId: 'cbb486bd-aa1b-4774-b7fa-0d482e969eab' }],
    ['scope', { scope: 'paid_report' }],
  ])('rejects tampering with %s', (_name, change) => {
    const token = issueValidationCapability(input, secret);
    expect(verifyValidationCapability(mutatePayload(token, change), input.validationSessionId, secret, issuedAt)).toBeNull();
  });

  it('rejects malformed signatures and missing server secret', () => {
    const token = issueValidationCapability(input, secret);
    expect(verifyValidationCapability(`${token}x`, input.validationSessionId, secret, issuedAt)).toBeNull();
    expect(verifyValidationCapability('not-a-token', input.validationSessionId, secret, issuedAt)).toBeNull();
    expect(verifyValidationCapability(token, input.validationSessionId, '', issuedAt)).toBeNull();
    expect(() => issueValidationCapability(input, '')).toThrow('missing_career_validation_secret');
  });

  it('reconstructs the exact same child capability without extending time', () => {
    const token = issueValidationCapability(input, secret);
    const session = {
      reportId: input.reportId, careerId: input.careerId, id: input.validationSessionId,
      capabilityIssuedAt: new Date(issuedAt).toISOString(),
      capabilityExpiresAt: new Date(issuedAt + 3_600_000).toISOString(),
    } as CareerValidationSession;
    expect(reconstructValidationCapability(session, secret)).toBe(token);
  });
});
