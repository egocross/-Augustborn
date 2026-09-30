import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import type { CareerValidationSession } from './schema';

export const CareerValidationCapabilitySchema = z.object({
  version: z.literal(1),
  scope: z.literal('career_validation'),
  reportId: z.string().uuid(),
  careerId: z.string().min(1).max(120),
  validationSessionId: z.string().uuid(),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
}).strict();
export type CareerValidationCapability = z.infer<typeof CareerValidationCapabilitySchema>;

function requireSecret(secret: string): void {
  if (!secret) throw new Error('missing_career_validation_secret');
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new Error('weak_career_validation_secret');
}

function sign(encoded: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(encoded, 'utf8').digest();
}

function encode(payload: CareerValidationCapability, secret: string): string {
  requireSecret(secret);
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded, secret).toString('base64url')}`;
}

export function issueValidationCapability(
  input: { reportId: string; careerId: string; validationSessionId: string; issuedAt: number; ttlSeconds: number },
  secret: string,
): string {
  requireSecret(secret);
  if (!Number.isSafeInteger(input.ttlSeconds) || input.ttlSeconds <= 0) throw new Error('invalid_career_validation_ttl');
  const payload = CareerValidationCapabilitySchema.parse({
    version: 1, scope: 'career_validation', reportId: input.reportId,
    careerId: input.careerId, validationSessionId: input.validationSessionId,
    issuedAt: input.issuedAt, expiresAt: input.issuedAt + input.ttlSeconds * 1000,
  });
  return encode(payload, secret);
}

export function inspectSignedValidationCapability(token: string, expectedSessionId: string, secret: string): CareerValidationCapability | null {
  try {
    requireSecret(secret);
    const [encoded, signature, extra] = token.split('.');
    if (!encoded || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
    const payloadBytes = Buffer.from(encoded, 'base64url');
    if (payloadBytes.toString('base64url') !== encoded) return null;
    const received = Buffer.from(signature, 'base64url');
    const expected = sign(encoded, secret);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const parsed = CareerValidationCapabilitySchema.safeParse(JSON.parse(payloadBytes.toString('utf8')));
    if (!parsed.success || parsed.data.validationSessionId !== expectedSessionId) return null;
    if (parsed.data.expiresAt <= parsed.data.issuedAt) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function verifyValidationCapability(token: string, expectedSessionId: string, secret: string, now = Date.now()): CareerValidationCapability | null {
  const payload = inspectSignedValidationCapability(token, expectedSessionId, secret);
  return payload && payload.issuedAt <= now && now < payload.expiresAt ? payload : null;
}

export function reconstructValidationCapability(session: CareerValidationSession, secret: string): string {
  const payload = CareerValidationCapabilitySchema.parse({
    version: 1, scope: 'career_validation', reportId: session.reportId,
    careerId: session.careerId, validationSessionId: session.id,
    issuedAt: Date.parse(session.capabilityIssuedAt),
    expiresAt: Date.parse(session.capabilityExpiresAt),
  });
  return encode(payload, secret);
}
