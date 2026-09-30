import 'server-only';

import { randomUUID } from 'node:crypto';

import { CareerReportSchema, type DeepReport } from '@/lib/deep-analysis/types';
import { issueValidationCapability } from './capability';
import { careerIdForHypothesis } from './snapshot';

export type ValidationAccess = {
  careerId: string;
  validationSessionId: string;
  capability: string;
};

export function createInitialValidationAccess(input: {
  reportId: string;
  report: DeepReport;
  persisted: boolean;
  issuedAt: number;
  ttlSeconds: number;
  secret: string;
}): ValidationAccess[] {
  if (!input.persisted || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.reportId)) return [];
  const parsed = CareerReportSchema.safeParse(input.report);
  if (!parsed.success) return [];
  return parsed.data.careerHypotheses.flatMap((hypothesis, index) => {
    if (!hypothesis.workValidation) return [];
    const careerId = careerIdForHypothesis(input.reportId, index, hypothesis.title);
    const validationSessionId = randomUUID();
    return [{
      careerId, validationSessionId,
      capability: issueValidationCapability({ reportId: input.reportId, careerId, validationSessionId, issuedAt: input.issuedAt, ttlSeconds: input.ttlSeconds }, input.secret),
    }];
  });
}
