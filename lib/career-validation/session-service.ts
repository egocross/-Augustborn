import 'server-only';

import { z } from 'zod';

import { CareerCalibrationSchema } from '@/lib/deep-analysis/career-calibration';
import { CareerReportSchema } from '@/lib/deep-analysis/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

import { authorizeValidationSession, validateSignedCapability, ValidationAccessError } from './authorize';
import { getCareerValidationConfig } from './config';
import { createCareerValidationRepository, type CareerValidationRepository } from './repository';
import { CareerValidationSessionSchema, type CareerValidationSession } from './schema';
import { buildInitialSnapshot } from './snapshot';

const PaidReportRowSchema = z.object({
  payment_status: z.literal('paid'), report_status: z.literal('complete'),
  report_result: CareerReportSchema, answers: CareerCalibrationSchema,
  updated_at: z.iso.datetime({ offset: true }),
});

type SessionRepository = Pick<CareerValidationRepository, 'get' | 'createInitial'>;
type SessionOptions = {
  secret?: string;
  now?: number;
  retentionDays?: number;
  repository?: SessionRepository;
  readReport?: (reportId: string) => Promise<unknown>;
};

async function readPaidReport(reportId: string): Promise<unknown> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
  const { data, error } = await admin.from('deep_report_sessions')
    .select('payment_status,report_status,report_result,answers,updated_at')
    .eq('id', reportId).maybeSingle();
  if (error) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
  return data;
}

function sessionIdFromToken(token: string): string {
  try {
    if (token.length > 5000) throw new Error('oversize');
    const encoded = token.split('.')[0];
    return z.string().uuid().parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')).validationSessionId);
  } catch {
    throw new ValidationAccessError('INVALID_CAPABILITY');
  }
}

export async function createOrRestoreSession(token: string, options: SessionOptions = {}): Promise<CareerValidationSession> {
  const id = sessionIdFromToken(token);
  const payload = validateSignedCapability(token, id, { secret: options.secret, now: options.now });
  const admin = !options.repository ? getSupabaseAdmin() : null;
  const repository = options.repository ?? (admin ? createCareerValidationRepository(admin) : null);
  if (!repository) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
  const authOptions = { repository, secret: options.secret, now: options.now };
  const existing = await repository.get(id);
  if (existing) return authorizeValidationSession(token, id, authOptions);

  const rawReport = await (options.readReport ?? readPaidReport)(payload.reportId);
  const paid = PaidReportRowSchema.safeParse(rawReport);
  if (!paid.success) throw new ValidationAccessError('SESSION_NOT_FOUND');
  const now = options.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  let snapshot;
  try {
    snapshot = buildInitialSnapshot({
      reportId: payload.reportId, careerId: payload.careerId,
      report: paid.data.report_result, calibration: paid.data.answers,
      reportCapturedAt: paid.data.updated_at, frozenAt: nowIso,
    });
  } catch {
    throw new ValidationAccessError('INVALID_CAPABILITY');
  }
  const retentionDays = options.retentionDays ?? getCareerValidationConfig().retentionDays;
  const session = CareerValidationSessionSchema.parse({
    id, reportId: payload.reportId, careerId: payload.careerId,
    parentValidationSessionId: null, status: 'created',
    validationContextSnapshot: snapshot, experiment: null, experimentVersion: null,
    submission: null, reflection: null, result: null, generationMetadata: null,
    revision: 1, operationKind: null, operationToken: null, operationLeaseExpiresAt: null,
    capabilityIssuedAt: new Date(payload.issuedAt).toISOString(),
    capabilityExpiresAt: new Date(payload.expiresAt).toISOString(),
    retentionExpiresAt: new Date(now + retentionDays * 86_400_000).toISOString(),
    createdAt: nowIso, updatedAt: nowIso, deletedAt: null,
  });
  await repository.createInitial(session);
  return authorizeValidationSession(token, id, authOptions);
}
