import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { ValidationAccessError } from '@/lib/career-validation/authorize';
import { getCareerValidationConfig } from '@/lib/career-validation/config';
import { generateCareerExperiment } from '@/lib/career-validation/experiment';
import { createCareerValidationRepository, type CareerValidationRepository } from '@/lib/career-validation/repository';
import type { CareerExperiment, CareerValidationSession } from '@/lib/career-validation/schema';
import { createOrRestoreSession } from '@/lib/career-validation/session-service';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const RequestSchema = z.object({ capability: z.string().min(1).max(5000) }).strict();
type ExperimentRepository = Pick<CareerValidationRepository, 'claimOperation' | 'completeExperiment'>;
type Dependencies = {
  getSession: (token: string) => Promise<CareerValidationSession>;
  repository: ExperimentRepository;
  generate: (session: CareerValidationSession, signal?: AbortSignal) => Promise<CareerExperiment>;
  now: () => string;
  operationToken: () => string;
};

export function createExperimentHandler(dependencies: Partial<Dependencies> = {}) {
  return async (request: Request): Promise<Response> => {
    const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
    try {
      const session = await (dependencies.getSession ?? createOrRestoreSession)(parsed.data.capability);
      if (session.experiment) return Response.json({ experiment: session.experiment }, { headers: { 'cache-control': 'no-store' } });
      const repository = dependencies.repository ?? (() => {
        const admin = getSupabaseAdmin();
        if (!admin) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
        return createCareerValidationRepository(admin);
      })();
      const token = (dependencies.operationToken ?? randomUUID)();
      const now = (dependencies.now ?? (() => new Date().toISOString()))();
      const claim = await repository.claimOperation({
        validationSessionId: session.id, kind: 'experiment', token, now,
        leaseSeconds: getCareerValidationConfig().leaseSeconds,
      });
      if (claim.outcome === 'in_progress') return Response.json({ code: 'OPERATION_IN_PROGRESS' }, { status: 202 });
      if (claim.outcome === 'gone') return Response.json({ code: 'SESSION_GONE' }, { status: 410 });
      if (claim.outcome === 'invalid_state') return Response.json({ code: 'INVALID_STATE' }, { status: 409 });
      if (claim.outcome === 'exists') return Response.json({ experiment: claim.session.experiment }, { headers: { 'cache-control': 'no-store' } });
      const experiment = await (dependencies.generate ?? generateCareerExperiment)(claim.session, request.signal);
      const completed = await repository.completeExperiment({
        validationSessionId: session.id, token, experiment,
        now: (dependencies.now ?? (() => new Date().toISOString()))(),
      });
      if (!completed) return Response.json({ code: 'SESSION_GONE' }, { status: 410 });
      return Response.json({ experiment: completed.experiment }, { headers: { 'cache-control': 'no-store' } });
    } catch (error) {
      if (error instanceof ValidationAccessError) return Response.json({ code: error.code }, { status: error.status });
      return Response.json({ code: 'EXPERIMENT_UNAVAILABLE' }, { status: 503 });
    }
  };
}

export const POST = createExperimentHandler();
