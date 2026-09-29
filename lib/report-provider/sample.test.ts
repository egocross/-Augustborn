import { afterEach, describe, expect, it } from 'vitest';

import { createChart } from '@/lib/bazi/chart';
import { CareerReportSchema, CareerWorkValidationSchema } from '@/lib/deep-analysis/types';
import { ReportSchema } from '@/lib/gemini/schema';
import { createSampleBaseReport, createSampleCareerReport } from './sample';
import { getReportProvider, usesSampleReports } from './config';

const chart = createChart({ birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '江苏南京', calendarType: 'solar' as const, isLeapMonth: false });

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

  it('produces an offline career report without invented recruitment facts', () => {
    const report = createSampleCareerReport({
      questionnaireVersion: 'career-v1',
      baseReport: createSampleBaseReport(chart),
      careerCalibration: {
        questionnaireVersion: 'career-v1',
        hardConstraints: {
          careerStatus: 'career_status_first_job', transitionUrgency: 'transition_3_months',
          income: { minimumIncomeBand: 'minimum_income_3000_5000', currency: 'CNY', salaryDropTolerance: 'salary_drop_none' },
          responsibilities: ['responsibility_none'], location: { mobility: 'mobility_nationwide', constraints: [] },
          transitionCapacity: { weeklyHours: 'weekly_hours_full_time', preparationHorizon: 'preparation_3_6_months', maxBudget: 'budget_none' },
          restartTolerance: 'restart_entry_level', educationTolerance: 'education_short', workConstraints: ['work_constraint_none'],
          incomeModels: ['income_model_any'], employmentTypes: ['employment_type_any'],
        },
        careerCapital: { experience: [], skills: [], evidence: [] }, values: ['value_growth'],
      },
    });
    expect(CareerReportSchema.parse(report).careerHypotheses).toHaveLength(3);
    expect(report.marketStatus).toBe('sample');
    expect(report.careerHypotheses.every((item) => item.evidenceStatus === 'unavailable')).toBe(true);
    expect(report.careerHypotheses.every((item) => item.sources.length === 0)).toBe(true);
    for (const hypothesis of report.careerHypotheses) {
      const validation = CareerWorkValidationSchema.parse(hypothesis.workValidation);
      expect(validation.careerName).toBe(hypothesis.title);
      expect(validation.workReality.evidence).toEqual([]);
      expect(validation.workReality.confidence).toBe('low');
      expect(validation.capabilitySignals.hiringSignalType).toMatch(
        /portfolio_project|business_result|experience_based|credential_required|hands_on_skill|senior_experience|mixed/,
      );
      expect(validation.capabilitySignals.criticalGaps.length).toBeGreaterThanOrEqual(1);
      expect(validation.capabilitySignals.criticalGaps.length).toBeLessThanOrEqual(3);
      expect(validation.validationPath.length).toBeGreaterThanOrEqual(2);
      expect(validation.validationPath.length).toBeLessThanOrEqual(4);
      expect(validation.validationPath.every((action) => (
        action.steps.length >= 3
        && action.estimatedTime.length > 0
        && action.estimatedCost.length > 0
        && action.deliverable.length > 0
        && action.successSignals.length > 0
      ))).toBe(true);
    }
    expect(report.careerHypotheses.some((item) => (
      item.workValidation.capabilitySignals.hardBarriers.length > 0
      && item.workValidation.capabilitySignals.bridgePaths.length > 0
    ))).toBe(true);
    expect(JSON.stringify(report)).not.toContain('招聘数量');
  });
});
