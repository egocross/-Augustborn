import 'server-only';

import { z } from 'zod';

import { createCareerValidationRepository, type CareerValidationRepository } from './repository';
import { ReflectionSchema, SubmissionSchema, type CareerValidationSession } from './schema';
import { createOrRestoreSession } from './session-service';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ValidationAccessError } from './authorize';

export const DraftPatchSchema = z.object({
  submission: SubmissionSchema.nullable().optional(),
  reflection: ReflectionSchema.nullable().optional(),
  status: z.enum(['in_progress', 'submitted']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export class ValidationDraftError extends Error {
  constructor(public readonly code: 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'SESSION_GONE', public readonly latestRevision?: number) {
    super(code);
    this.name = 'ValidationDraftError';
  }
  get status() { return this.code === 'INVALID_INPUT' ? 400 : this.code === 'SESSION_GONE' ? 410 : 409; }
}

type Dependencies = {
  getSession: (token: string) => Promise<CareerValidationSession>;
  repository: Pick<CareerValidationRepository, 'patch'>;
  now: () => string;
};

export async function saveValidationDraft(
  input: { capability: string; expectedRevision: number; patch: unknown },
  dependencies: Partial<Dependencies> = {},
): Promise<{ session: CareerValidationSession; revision: number }> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) throw new ValidationDraftError('INVALID_INPUT');
  const parsed = DraftPatchSchema.safeParse(input.patch);
  if (!parsed.success) throw new ValidationDraftError('INVALID_INPUT');
  const session = await (dependencies.getSession ?? createOrRestoreSession)(input.capability);
  if (session.status === 'deleted') throw new ValidationDraftError('SESSION_GONE');
  if (!['ready', 'in_progress', 'submitted', 'analysis_failed'].includes(session.status)) throw new ValidationDraftError('INVALID_STATE');
  if (session.revision !== input.expectedRevision) throw new ValidationDraftError('VERSION_CONFLICT', session.revision);
  const effectiveSubmission = parsed.data.submission === undefined ? session.submission : parsed.data.submission;
  const effectiveReflection = parsed.data.reflection === undefined ? session.reflection : parsed.data.reflection;
  if (parsed.data.status === 'submitted' && (!effectiveSubmission || !effectiveReflection)) throw new ValidationDraftError('INVALID_INPUT');
  const repository = dependencies.repository ?? (() => {
    const admin = getSupabaseAdmin();
    if (!admin) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
    return createCareerValidationRepository(admin);
  })();
  const outcome = await repository.patch({
    validationSessionId: session.id, expectedRevision: input.expectedRevision,
    patch: parsed.data, now: (dependencies.now ?? (() => new Date().toISOString()))(),
  });
  if (outcome.outcome === 'conflict') throw new ValidationDraftError('VERSION_CONFLICT', outcome.latestRevision);
  if (outcome.outcome === 'gone') throw new ValidationDraftError('SESSION_GONE');
  if (outcome.outcome === 'invalid_state') throw new ValidationDraftError('INVALID_STATE');
  return { session: outcome.session, revision: outcome.session.revision };
}
