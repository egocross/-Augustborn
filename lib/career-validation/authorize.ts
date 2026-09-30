import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin';

import { inspectSignedValidationCapability, type CareerValidationCapability } from './capability';
import { createCareerValidationRepository } from './repository';
import type { CareerValidationSession } from './schema';

export type ValidationAccessCode =
  | 'VALIDATION_UNAVAILABLE' | 'INVALID_CAPABILITY' | 'CAPABILITY_EXPIRED'
  | 'SESSION_NOT_FOUND' | 'SESSION_GONE';

export class ValidationAccessError extends Error {
  readonly status: number;
  constructor(public readonly code: ValidationAccessCode) {
    super(code);
    this.name = 'ValidationAccessError';
    this.status = code === 'SESSION_NOT_FOUND' ? 404
      : code === 'SESSION_GONE' || code === 'CAPABILITY_EXPIRED' ? 410
        : code === 'VALIDATION_UNAVAILABLE' ? 503 : 403;
  }
}

type ReadRepository = { get(validationSessionId: string): Promise<CareerValidationSession | null> };
type AuthorizationOptions = { secret?: string; now?: number; repository?: ReadRepository };

function configuredSecret(options?: AuthorizationOptions): string {
  const secret = options?.secret ?? process.env.CAREER_VALIDATION_CAPABILITY_SECRET ?? '';
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
  return secret;
}

export function validateSignedCapability(
  token: string,
  expectedSessionId: string,
  options?: Pick<AuthorizationOptions, 'secret' | 'now'>,
): CareerValidationCapability {
  const secret = configuredSecret(options);
  const payload = inspectSignedValidationCapability(token, expectedSessionId, secret);
  if (!payload) throw new ValidationAccessError('INVALID_CAPABILITY');
  const now = options?.now ?? Date.now();
  if (now >= payload.expiresAt || now < payload.issuedAt) throw new ValidationAccessError('CAPABILITY_EXPIRED');
  return payload;
}

export async function authorizeValidationSession(
  token: string,
  expectedSessionId: string,
  options?: AuthorizationOptions,
): Promise<CareerValidationSession> {
  const payload = validateSignedCapability(token, expectedSessionId, options);
  const repository = options?.repository ?? (() => {
    const admin = getSupabaseAdmin();
    if (!admin) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
    return createCareerValidationRepository(admin);
  })();
  const session = await repository.get(expectedSessionId);
  if (!session) throw new ValidationAccessError('SESSION_NOT_FOUND');
  if (session.status === 'deleted' || session.deletedAt || Date.parse(session.retentionExpiresAt) <= (options?.now ?? Date.now())) {
    throw new ValidationAccessError('SESSION_GONE');
  }
  if (session.reportId !== payload.reportId || session.careerId !== payload.careerId
    || session.id !== payload.validationSessionId
    || Date.parse(session.capabilityIssuedAt) !== payload.issuedAt
    || Date.parse(session.capabilityExpiresAt) !== payload.expiresAt) {
    throw new ValidationAccessError('INVALID_CAPABILITY');
  }
  return session;
}
