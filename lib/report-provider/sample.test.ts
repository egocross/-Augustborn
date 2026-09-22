import { afterEach, describe, expect, it } from 'vitest';

import { createChart } from '@/lib/bazi/chart';
import { QUESTION_BANK_V1 } from '@/lib/deep-analysis/questions';
import { DeepReportSchema, DynamicQuestionSchema } from '@/lib/deep-analysis/types';
import { ReportSchema } from '@/lib/gemini/schema';
import { createSampleBaseReport, createSampleCustomQuestions, createSampleDeepReport } from './sample';
import { getReportProvider, usesSampleReports } from './config';

const chart = createChart({ birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '江苏南京' });

afterEach(() => {
  delete process.env.REPORT_PROVIDER;
});

describe('report provider selection', () => {
  it('defaults to the Gemini provider so production never ships sample content by accident', () => {
    expect(getReportProvider()).toBe('gemini');
    expect(usesSampleReports()).toBe(false);
  });

  it('only treats an explicit sample value as local content', () => {
    process.env.REPORT_PROVIDER = ' sample ';
    expect(usesSampleReports()).toBe(true);

    process.env.REPORT_PROVIDER = 'gemini';
    expect(usesSampleReports()).toBe(false);

    process.env.REPORT_PROVIDER = 'unexpected';
    expect(getReportProvider()).toBe('gemini');
  });
});

describe('sample report content', () => {
  it('produces a base report that satisfies the shipped schema', () => {
    const report = createSampleBaseReport(chart);
    expect(ReportSchema.parse(report).sections.length).toBeGreaterThan(1);
    expect(report.sections[0].heading).toBe('核心性格与底层矛盾');
    expect(report.disclaimer).toContain('未调用 Gemini');
  });

  it('echoes the submitted birth information so the flow is verifiable', () => {
    const report = createSampleBaseReport(chart);
    expect(report.sections[0].body).toContain('1977-10-15');
    expect(report.sections[0].body).toContain('江苏南京');
  });

  it('produces a deep report per direction that satisfies the shipped schema', () => {
    for (const directionId of ['work', 'industry', 'city', 'collaboration', 'custom'] as const) {
      const report = createSampleDeepReport({ directionId, optionalContext: '' });
      expect(DeepReportSchema.parse(report).cards.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('produces custom follow-up questions that satisfy the shipped schema', () => {
    const questions = createSampleCustomQuestions({ customQuestion: '我要不要转岗？' });
    expect(questions).toHaveLength(3);
    for (const question of questions) {
      expect(DynamicQuestionSchema.parse(question).id).toMatch(/^custom_q[1-5]$/);
    }
  });

  it('keeps the fixed questionnaire untouched', () => {
    expect(QUESTION_BANK_V1.work).toHaveLength(5);
  });
});
