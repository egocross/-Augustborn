import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { ReportSchema, type Report } from '@/lib/gemini/schema';

const TOKEN_VERSION = 'v1';
const DEVELOPMENT_SECRET = 'jianvia-development-base-report-snapshot-v1';

const configuredSecret = (): string => {
  const secret = process.env.BASE_REPORT_SNAPSHOT_SECRET?.trim()
    || process.env.PAYMENT_RECEIPT_SECRET?.trim()
    || process.env.MOCK_PAYMENT_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BASE_REPORT_SNAPSHOT_SECRET must be configured in production.');
  }
  return DEVELOPMENT_SECRET;
};

const canonicalReportJson = (report: Report): string => {
  const parsed = ReportSchema.parse(report);
  return JSON.stringify({
    sections: parsed.sections.map((section) => ({
      heading: section.heading,
      body: section.body,
      bullets: [...section.bullets],
    })),
    disclaimer: parsed.disclaimer,
  });
};

const digestReport = (report: Report): string =>
  createHash('sha256').update(canonicalReportJson(report), 'utf8').digest('hex');

const sign = (digest: string): string =>
  createHmac('sha256', configuredSecret()).update(`${TOKEN_VERSION}.${digest}`, 'utf8').digest('base64url');

export function issueBaseReportSnapshot(report: Report): string {
  const digest = digestReport(report);
  return `${TOKEN_VERSION}.${digest}.${sign(digest)}`;
}

export function verifyBaseReportSnapshot(report: Report, token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [version, tokenDigest, tokenSignature] = parts;
  if (version !== TOKEN_VERSION || !/^[a-f0-9]{64}$/.test(tokenDigest) || !tokenSignature) return false;

  let reportDigest: string;
  try {
    reportDigest = digestReport(report);
  } catch {
    return false;
  }
  if (reportDigest !== tokenDigest) return false;

  const expected = Buffer.from(sign(tokenDigest), 'base64url');
  const received = Buffer.from(tokenSignature, 'base64url');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
