import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Report } from '@/lib/gemini/schema';
import { issueBaseReportSnapshot, verifyBaseReportSnapshot } from './base-report-snapshot';

const report: Report = {
  sections: [
    { heading: '核心结构', body: '正文', bullets: ['要点一', '要点二'] },
    { heading: '现实方向', body: '方向正文', bullets: [] },
  ],
  disclaimer: '仅供探索参考。',
};

beforeEach(() => {
  vi.stubEnv('MOCK_PAYMENT_SECRET', 'snapshot-test-secret');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('base report snapshot handoff', () => {
  it('verifies the exact parsed report issued by the server', () => {
    const token = issueBaseReportSnapshot(report);

    expect(token).toMatch(/^v1\.[a-f0-9]{64}\.[A-Za-z0-9_-]+$/);
    expect(verifyBaseReportSnapshot(report, token)).toBe(true);
  });

  it.each([
    ['heading', { ...report, sections: [{ ...report.sections[0], heading: '被改过' }, report.sections[1]] }],
    ['body', { ...report, sections: [{ ...report.sections[0], body: '被改过' }, report.sections[1]] }],
    ['bullet', { ...report, sections: [{ ...report.sections[0], bullets: ['被改过'] }, report.sections[1]] }],
    ['disclaimer', { ...report, disclaimer: '被改过' }],
  ])('rejects a changed %s', (_label, changed) => {
    const token = issueBaseReportSnapshot(report);

    expect(verifyBaseReportSnapshot(changed, token)).toBe(false);
  });

  it('fails closed for malformed or unsigned tokens', () => {
    expect(verifyBaseReportSnapshot(report, '')).toBe(false);
    expect(verifyBaseReportSnapshot(report, 'unsigned')).toBe(false);
    expect(verifyBaseReportSnapshot(report, 'v1.bad.bad')).toBe(false);
  });

  it('requires an explicit signing secret in production', () => {
    vi.stubEnv('MOCK_PAYMENT_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => issueBaseReportSnapshot(report)).toThrow('BASE_REPORT_SNAPSHOT_SECRET');
  });
});
