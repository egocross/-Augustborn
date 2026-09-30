import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { ValidationAccessError } from '@/lib/career-validation/authorize';
import { getCareerValidationConfig } from '@/lib/career-validation/config';
import { analyzeValidationSession } from '@/lib/career-validation/evaluation';
import { createCareerValidationRepository, type CareerValidationRepository } from '@/lib/career-validation/repository';
import type { CareerValidationSession, ValidationResult } from '@/lib/career-validation/schema';
import { createOrRestoreSession } from '@/lib/career-validation/session-service';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const maxDuration = 300;
const RequestSchema = z.object({ capability: z.string().min(1).max(5000) }).strict();
type AnalysisRepository = Pick<CareerValidationRepository, 'claimOperation' | 'completeAnalysis' | 'failOperation'>;
type Dependencies = {
  getSession: (token: string) => Promise<CareerValidationSession>;
  repository: AnalysisRepository;
  analyze: (session: CareerValidationSession, signal?: AbortSignal) => Promise<ValidationResult>;
  now: () => string;
  operationToken: () => string;
};

export function createAnalyzeHandler(dependencies: Partial<Dependencies> = {}) {
  return async (request: Request): Promise<Response> => {
    const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
    try {
      const session = await (dependencies.getSession ?? createOrRestoreSession)(parsed.data.capability);
      if (session.result) return Response.json({ result: session.result }, { headers: { 'cache-control': 'no-store' } });
      const repository = dependencies.repository ?? (() => {
        const admin = getSupabaseAdmin();
        if (!admin) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
        return createCareerValidationRepository(admin);
      })();
      const token = (dependencies.operationToken ?? randomUUID)();
      const now = (dependencies.now ?? (() => new Date().toISOString()))();
      const claim = await repository.claimOperation({
        validationSessionId: session.id, kind: 'analysis', token, now,
        leaseSeconds: getCareerValidationConfig().leaseSeconds,
      });
      if (claim.outcome === 'in_progress') return Response.json({ code: 'OPERATION_IN_PROGRESS' }, { status: 202 });
      if (claim.outcome === 'gone') return Response.json({ code: 'SESSION_GONE' }, { status: 410 });
      if (claim.outcome === 'invalid_state') return Response.json({ code: 'INVALID_STATE' }, { status: 409 });
      if (claim.outcome === 'exists') return Response.json({ result: claim.session.result }, { headers: { 'cache-control': 'no-store' } });
      let result: ValidationResult;
      try {
        result = await (dependencies.analyze ?? analyzeValidationSession)(claim.session, request.signal);
      } catch {
        try {
          await repository.failOperation({
            validationSessionId: session.id, kind: 'analysis', token,
            now: (dependencies.now ?? (() => new Date().toISOString()))(),
          });
        } catch { /* Failed lease is recoverable after expiry. */ }
        return Response.json({ code: 'ANALYSIS_FAILED' }, { status: 503 });
      }
      const completed = await repository.completeAnalysis({
        validationSessionId: session.id, token, result,
        now: (dependencies.now ?? (() => new Date().toISOString()))(),
      });
      if (!completed) return Response.json({ code: 'SESSION_GONE' }, { status: 410 });
      return Response.json({ result: completed.result }, { headers: { 'cache-control': 'no-store' } });
    } catch (error) {
      if (error instanceof ValidationAccessError) return Response.json({ code: error.code }, { status: error.status });
      return Response.json({ code: 'ANALYSIS_UNAVAILABLE' }, { status: 503 });
    }
  };
}

export const POST = createAnalyzeHandler();
