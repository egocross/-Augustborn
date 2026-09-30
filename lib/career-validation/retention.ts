import 'server-only';

import { createCareerValidationRepository, type CareerValidationRepository } from './repository';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ValidationAccessError } from './authorize';

type Repository = Pick<CareerValidationRepository, 'sweepExpired'>;

export async function sweepCareerValidationSessions(
  now: Date,
  options: { repository?: Repository; batchSize?: number } = {},
): Promise<{ erased: number; purged: number }> {
  if (Number.isNaN(now.getTime())) throw new Error('invalid_retention_time');
  const repository = options.repository ?? (() => {
    const admin = getSupabaseAdmin();
    if (!admin) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
    return createCareerValidationRepository(admin);
  })();
  const batchSize = options.batchSize ?? 100;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error('invalid_retention_batch');
  const total = { erased: 0, purged: 0 };
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await repository.sweepExpired(now.toISOString(), batchSize);
    total.erased += result.erased;
    total.purged += result.purged;
    if (result.erased < batchSize && result.purged < batchSize) break;
  }
  return total;
}
