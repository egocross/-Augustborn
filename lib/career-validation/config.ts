export type CareerValidationConfig = {
  capabilityTtlSeconds: number;
  retentionDays: number;
  leaseSeconds: number;
};

function duration(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`Invalid ${name}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Invalid ${name}`);
  return parsed;
}

export function getCareerValidationConfig(env: Record<string, string | undefined> = process.env): CareerValidationConfig {
  return {
    capabilityTtlSeconds: duration(env.CAREER_VALIDATION_CAPABILITY_TTL_SECONDS, 2_592_000, 'CAREER_VALIDATION_CAPABILITY_TTL_SECONDS'),
    retentionDays: duration(env.CAREER_VALIDATION_RETENTION_DAYS, 180, 'CAREER_VALIDATION_RETENTION_DAYS'),
    leaseSeconds: duration(env.CAREER_VALIDATION_LEASE_SECONDS, 120, 'CAREER_VALIDATION_LEASE_SECONDS'),
  };
}
