import 'server-only';

import { randomUUID } from 'node:crypto';

import { ValidationAccessError } from './authorize';
import { issueValidationCapability, reconstructValidationCapability } from './capability';
import { getCareerValidationConfig } from './config';
import { createCareerValidationRepository, type CareerValidationRepository } from './repository';
import { CareerValidationSessionSchema, type CareerValidationSession } from './schema';
import { createOrRestoreSession } from './session-service';
import { buildChildSnapshot } from './snapshot';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export class NextValidationError extends Error {
  constructor(public readonly code: 'NEXT_ACTION_NOT_IN_PRODUCT' | 'SESSION_GONE') {
    super(code);
    this.name = 'NextValidationError';
  }
  get status() { return this.code === 'SESSION_GONE' ? 410 : 409; }
}

type Dependencies = {
  getParent: (token: string) => Promise<CareerValidationSession>;
  repository: Pick<CareerValidationRepository, 'createChild'>;
  secret: string;
  now: number;
  ttlSeconds: number;
  retentionDays: number;
};

export async function createNextValidationSession(parentToken: string, dependencies: Partial<Dependencies> = {}): Promise<{ validationSessionId: string; capability: string }> {
  const parent = await (dependencies.getParent ?? createOrRestoreSession)(parentToken);
  if (parent.status !== 'completed' || !parent.result || !parent.validationContextSnapshot
    || parent.result.nextAction.type !== 'in_product_experiment' || !parent.result.nextAction.canStartInProduct) {
    throw new NextValidationError('NEXT_ACTION_NOT_IN_PRODUCT');
  }
  const secret = dependencies.secret ?? process.env.CAREER_VALIDATION_CAPABILITY_SECRET ?? '';
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
  const config = getCareerValidationConfig();
  const now = dependencies.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const id = randomUUID();
  const ttlSeconds = dependencies.ttlSeconds ?? config.capabilityTtlSeconds;
  const retentionDays = dependencies.retentionDays ?? config.retentionDays;
  const snapshot = buildChildSnapshot(parent, id, nowIso);
  const child = CareerValidationSessionSchema.parse({
    id, reportId: parent.reportId, careerId: parent.careerId,
    parentValidationSessionId: parent.id, status: 'created', validationContextSnapshot: snapshot,
    experiment: null, experimentVersion: null, submission: null, reflection: null, result: null,
    generationMetadata: null, revision: 1, operationKind: null, operationToken: null, operationLeaseExpiresAt: null,
    capabilityIssuedAt: nowIso, capabilityExpiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
    retentionExpiresAt: new Date(now + retentionDays * 86_400_000).toISOString(),
    createdAt: nowIso, updatedAt: nowIso, deletedAt: null,
  });
  const repository = dependencies.repository ?? (() => {
    const admin = getSupabaseAdmin();
    if (!admin) throw new ValidationAccessError('VALIDATION_UNAVAILABLE');
    return createCareerValidationRepository(admin);
  })();
  const stored = await repository.createChild(child);
  if (stored.parentValidationSessionId !== parent.id || stored.reportId !== parent.reportId || stored.careerId !== parent.careerId) {
    throw new ValidationAccessError('INVALID_CAPABILITY');
  }
  if (stored.deletedAt || stored.status === 'deleted' || Date.parse(stored.retentionExpiresAt) <= now) throw new NextValidationError('SESSION_GONE');
  const capability = stored.id === child.id
    ? issueValidationCapability({ reportId: stored.reportId, careerId: stored.careerId, validationSessionId: stored.id, issuedAt: now, ttlSeconds }, secret)
    : reconstructValidationCapability(stored, secret);
  return { validationSessionId: stored.id, capability };
}
