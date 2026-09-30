import { z } from 'zod';

import { ValidationAccessError } from '@/lib/career-validation/authorize';
import { createOrRestoreSession } from '@/lib/career-validation/session-service';
import { DraftPatchSchema, saveValidationDraft, ValidationDraftError } from '@/lib/career-validation/draft-service';

const RequestSchema = z.object({ capability: z.string().min(1).max(5000) }).strict();

export function createSessionHandler(dependencies: { createOrRestore: (token: string) => Promise<unknown> } = { createOrRestore: createOrRestoreSession }) {
  return async (request: Request): Promise<Response> => {
    const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
    try {
      const session = await dependencies.createOrRestore(parsed.data.capability);
      return Response.json({ session }, { headers: { 'cache-control': 'no-store' } });
    } catch (error) {
      if (error instanceof ValidationAccessError) return Response.json({ code: error.code }, { status: error.status });
      return Response.json({ code: 'VALIDATION_UNAVAILABLE' }, { status: 503 });
    }
  };
}

export const POST = createSessionHandler();

const PatchRequestSchema = z.object({
  capability: z.string().min(1).max(5000), expectedRevision: z.number().int().positive(), patch: DraftPatchSchema,
}).strict();

export function createSessionPatchHandler(dependencies: { save: typeof saveValidationDraft } = { save: saveValidationDraft }) {
  return async (request: Request): Promise<Response> => {
    const parsed = PatchRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
    try {
      const result = await dependencies.save(parsed.data);
      return Response.json(result, { headers: { 'cache-control': 'no-store' } });
    } catch (error) {
      if (error instanceof ValidationAccessError || error instanceof ValidationDraftError) {
        return Response.json({ code: error.code, ...(error instanceof ValidationDraftError && error.latestRevision !== undefined ? { latestRevision: error.latestRevision } : {}) }, { status: error.status });
      }
      return Response.json({ code: 'VALIDATION_UNAVAILABLE' }, { status: 503 });
    }
  };
}

export const PATCH = createSessionPatchHandler();
