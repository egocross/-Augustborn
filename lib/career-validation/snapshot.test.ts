import { describe, expect, it } from 'vitest';

import type { CareerCalibration } from '@/lib/deep-analysis/career-calibration';
import type { CareerReport } from '@/lib/deep-analysis/types';
import { createSampleCareerReport } from '@/lib/report-provider/sample';

import { buildChildSnapshot, buildInitialSnapshot, careerIdForHypothesis, verifyContextHash } from './snapshot';
import { CareerValidationSessionSchema } from './schema';

const calibration: CareerCalibration = {
  questionnaireVersion: 'career-v1',
  hardConstraints: {
    careerStatus: 'career_status_first_job', transitionUrgency: 'transition_3_months',
    income: { minimumIncomeBand: 'minimum_income_3000_5000', currency: 'CNY', salaryDropTolerance: 'salary_drop_none' },
    responsibilities: ['responsibility_none'], location: { mobility: 'mobility_nationwide', constraints: [] },
    transitionCapacity: { weeklyHours: 'weekly_hours_full_time', preparationHorizon: 'preparation_3_6_months', maxBudget: 'budget_none' },
    restartTolerance: 'restart_entry_level', educationTolerance: 'education_short', workConstraints: ['work_constraint_none'],
    incomeModels: ['income_model_any'], employmentTypes: ['employment_type_any'],
  },
  careerCapital: { experience: ['capital_operations'], skills: ['capital_content'], evidence: [] }, values: ['value_growth'],
};

function sampleReport(): CareerReport {
  return createSampleCareerReport({
    baseReport: { sections: [{ heading: '职业线索', body: '寻找可以验证的工作', bullets: [] }], disclaimer: '仅供参考' },
    careerCalibration: calibration, questionnaireVersion: 'career-v1',
  });
}

const reportId = '941deece-021b-4d4b-b880-674d1af568f1';
const frozenAt = '2026-09-30T12:00:00.000Z';

describe('trusted frozen context', () => {
  it('distinguishes duplicate titles by report position and selects only the bound hypothesis', () => {
    const report = sampleReport();
    report.careerHypotheses[1] = { ...report.careerHypotheses[1], title: report.careerHypotheses[0].title };
    const firstId = careerIdForHypothesis(reportId, 0, report.careerHypotheses[0].title);
    const secondId = careerIdForHypothesis(reportId, 1, report.careerHypotheses[1].title);
    expect(firstId).not.toBe(secondId);
    const second = buildInitialSnapshot({ reportId, careerId: secondId, report, calibration, reportCapturedAt: frozenAt, frozenAt });
    expect(second.career.careerId).toBe(secondId);
    expect(second.career.candidateReason).toBe(report.careerHypotheses[1].whyConsidered);
    expect(() => buildInitialSnapshot({ reportId, careerId: 'other-career', report, calibration, reportCapturedAt: frozenAt, frozenAt })).toThrow();
  });

  it('is a deep frozen copy that does not drift when the paid report changes', () => {
    const report = sampleReport();
    const careerId = careerIdForHypothesis(reportId, 0, report.careerHypotheses[0].title);
    const snapshot = buildInitialSnapshot({ reportId, careerId, report, calibration, reportCapturedAt: frozenAt, frozenAt });
    const hash = snapshot.contextHash;
    report.careerHypotheses[0].whyConsidered = 'changed upstream';
    calibration.careerCapital.skills.push('capital_data');
    expect(snapshot.career.candidateReason).not.toBe('changed upstream');
    expect(snapshot.relevantCareerCapital.skills).not.toContain('capital_data');
    expect(snapshot.contextHash).toBe(hash);
    expect(verifyContextHash(JSON.parse(JSON.stringify(snapshot)))).toBe(true);
    expect(verifyContextHash({ ...snapshot, career: { ...snapshot.career, candidateReason: 'tampered' } })).toBe(false);
  });

  it('only copies a minimum parent result summary into a child', () => {
    const report = sampleReport();
    const careerId = careerIdForHypothesis(reportId, 0, report.careerHypotheses[0].title);
    const snapshot = buildInitialSnapshot({ reportId, careerId, report, calibration, reportCapturedAt: frozenAt, frozenAt });
    const parent = CareerValidationSessionSchema.parse({
      id: '06e0dfdd-f521-43ab-b2b4-dcadf131c04d', reportId, careerId, status: 'completed', validationContextSnapshot: snapshot,
      parentValidationSessionId: null, experiment: null, experimentVersion: null, reflection: null,
      submission: { format: 'markdown', content: 'private submitted Markdown must never be copied', attachments: [] },
      result: { status: 'insufficient_evidence', validatedQuestion: '是否喜欢真实任务', evidence: [], supportingEvidence: [], riskSignals: [], unknowns: ['缺少市场反馈'], reasoning: 'only one attempt', nextAction: { type: 'in_product_experiment', title: '再做一次', detail: '补充证据', cost: '免费', canStartInProduct: true }, analyzedAt: frozenAt, generationMetadata: { evaluationPromptVersion: '1', rubricVersion: '1', evaluationModelId: 'sample' } },
      generationMetadata: null, revision: 1, operationKind: null, operationToken: null, operationLeaseExpiresAt: null,
      capabilityIssuedAt: frozenAt, capabilityExpiresAt: '2026-10-30T12:00:00.000Z', retentionExpiresAt: '2027-03-29T12:00:00.000Z',
      createdAt: frozenAt, updatedAt: frozenAt, deletedAt: null,
    });
    const child = buildChildSnapshot(parent, 'cbb486bd-aa1b-4774-b7fa-0d482e969eab', '2026-10-01T00:00:00.000Z');
    expect(child.parentResultSummary?.parentValidationSessionId).toBe(parent.id);
    expect(child.parentResultSummary?.unknowns).toEqual(['缺少市场反馈']);
    expect(JSON.stringify(child)).not.toContain('private submitted Markdown');
    expect(child.contextHash).not.toBe(snapshot.contextHash);
  });

  it('accepts only report-attached sources and never promotes unverified credentials', () => {
    const report = sampleReport();
    const hypothesis = report.careerHypotheses[0];
    const work = hypothesis.workValidation!;
    work.workReality.evidence.push({ sourceType: 'job_posting', title: 'Unattached model source', source: 'Unknown', url: 'https://example.com/fake', fact: 'fake' });
    work.workReality.evidence.push({ sourceType: 'official', title: 'Attached official source', source: 'gov.cn', url: 'https://example.gov.cn/rules', fact: 'entry rule' });
    work.capabilitySignals.hardBarriers.push({ barrier: '需要资格证', explanation: '尚未核实法规', evidenceStatus: 'verified' });
    hypothesis.sources.push({ title: 'Attached official source', site: 'gov.cn', url: 'https://example.gov.cn/rules', excerpt: 'entry rule' });
    const careerId = careerIdForHypothesis(reportId, 0, hypothesis.title);
    const snapshot = buildInitialSnapshot({ reportId, careerId, report, calibration, reportCapturedAt: frozenAt, frozenAt });
    expect(snapshot.marketEvidence.sources.map((source) => source.sourceUrl)).toEqual(['https://example.gov.cn/rules']);
    expect(snapshot.marketEvidence.sources[0].retrievedAt).toBe(frozenAt);
    expect(snapshot.workValidation.capabilitySignals.hardBarriers[0].evidenceStatus).toBe('uncertain');
  });
});
