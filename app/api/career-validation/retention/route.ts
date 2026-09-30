import { timingSafeEqual } from 'node:crypto';

import { sweepCareerValidationSessions } from '@/lib/career-validation/retention';

export function createRetentionHandler(dependencies: {
  sweep: (now: Date) => Promise<{ erased: number; purged: number }>;
  secret: string;
} = { sweep: sweepCareerValidationSessions, secret: process.env.CRON_SECRET ?? '' }) {
  return async (request: Request): Promise<Response> => {
    const expected = Buffer.from(`Bearer ${dependencies.secret}`);
    const supplied = Buffer.from(request.headers.get('authorization') ?? '');
    if (!dependencies.secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });
    }
    try {
      return Response.json(await dependencies.sweep(new Date()), { headers: { 'cache-control': 'no-store' } });
    } catch {
      return Response.json({ code: 'RETENTION_UNAVAILABLE' }, { status: 503 });
    }
  };
}

export const GET = createRetentionHandler();
