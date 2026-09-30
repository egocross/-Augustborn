import { describe, expect, it } from 'vitest';

import { getCareerValidationConfig } from './config';

describe('career validator configuration', () => {
  it('uses documented defaults', () => {
    expect(getCareerValidationConfig({})).toEqual({
      capabilityTtlSeconds: 2_592_000, retentionDays: 180, leaseSeconds: 120,
    });
  });

  it('accepts positive integer overrides without coupling retention to capability TTL', () => {
    expect(getCareerValidationConfig({
      CAREER_VALIDATION_CAPABILITY_TTL_SECONDS: '5184000',
      CAREER_VALIDATION_RETENTION_DAYS: '1',
      CAREER_VALIDATION_LEASE_SECONDS: '90',
    })).toEqual({ capabilityTtlSeconds: 5_184_000, retentionDays: 1, leaseSeconds: 90 });
  });

  it.each(['0', '-1', '1.5', 'NaN', ''])('rejects invalid configured duration %s', (value) => {
    expect(() => getCareerValidationConfig({ CAREER_VALIDATION_RETENTION_DAYS: value })).toThrow();
  });
});
