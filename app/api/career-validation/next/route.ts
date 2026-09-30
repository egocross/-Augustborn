import { z } from 'zod';

import { ValidationAccessError } from '@/lib/career-validation/authorize';
import { createNextValidationSession, NextValidationError } from '@/lib/career-validation/next-service';

const RequestSchema = z.object({ capability: z.string().min(1).max(5000) }).strict();

export function createNextHandler(dependencies: { createNext: typeof createNextValidationSession } = { createNext: createNextValidationSession }) {
  return async (request: Request): Promise<Response> => {
    const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
    try {
      const child = await dependencies.createNext(parsed.data.capability);
      return Response.json(child, { headers: { 'cache-control': 'no-store' } });
    } catch (error) {
      if (error instanceof ValidationAccessError || error instanceof NextValidationError) {
        return Response.json({ code: error.code }, { status: error.status });
      }
      return Response.json({ code: 'VALIDATION_UNAVAILABLE' }, { status: 503 });
    }
  };
}

export const POST = createNextHandler();
