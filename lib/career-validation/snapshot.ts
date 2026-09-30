import { createHash } from 'node:crypto';

import type { CareerCalibration } from '@/lib/deep-analysis/career-calibration';
import { CareerReportSchema, CareerWorkValidationSchema, type CareerReport } from '@/lib/deep-analysis/types';

import { ValidationContextSnapshotSchema, type CareerValidationSession, type ValidationContextSnapshot } from './schema';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function finalizeSnapshot(value: Omit<ValidationContextSnapshot, 'contextHash'>): ValidationContextSnapshot {
  const clean = ValidationContextSnapshotSchema.omit({ contextHash: true }).parse(value);
  return ValidationContextSnapshotSchema.parse({ ...clean, contextHash: digest(clean) });
}

export function verifyContextHash(input: unknown): boolean {
  const parsed = ValidationContextSnapshotSchema.safeParse(input);
  if (!parsed.success) return false;
  const { contextHash, ...content } = parsed.data;
  return digest(content) === contextHash;
}

export function careerIdForHypothesis(reportId: string, index: number, title: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(reportId) || !Number.isInteger(index) || index < 0 || !title.trim()) {
    throw new Error('Invalid bound career identity');
  }
  return `career-${index + 1}-${digest(title.trim().normalize('NFKC')).slice(0, 12)}`;
}

export function buildInitialSnapshot(input: {
  reportId: string; careerId: string; report: CareerReport; calibration: CareerCalibration;
  reportCapturedAt: string; frozenAt: string;
}): ValidationContextSnapshot {
  const report = CareerReportSchema.parse(input.report);
  const index = report.careerHypotheses.findIndex((hypothesis, position) =>
    careerIdForHypothesis(input.reportId, position, hypothesis.title) === input.careerId);
  if (index < 0) throw new Error('Career does not belong to this report');
  const hypothesis = report.careerHypotheses[index];
  if (!hypothesis.workValidation) throw new Error('Career lacks a validation plan');

  const approvedUrls = new Set(hypothesis.sources.map((source) => source.url));
  const approvedEvidence = hypothesis.workValidation.workReality.evidence.filter((item) => item.url && approvedUrls.has(item.url));
  const workValidation = CareerWorkValidationSchema.parse({
    ...hypothesis.workValidation,
    workReality: { ...hypothesis.workValidation.workReality, evidence: approvedEvidence },
    capabilitySignals: {
      ...hypothesis.workValidation.capabilitySignals,
      hardBarriers: hypothesis.workValidation.capabilitySignals.hardBarriers.map((barrier) => ({
        ...barrier, evidenceStatus: 'uncertain' as const,
      })),
    },
  });

  const constraints = input.calibration.hardConstraints;
  return finalizeSnapshot({
    version: 1,
    sourceReport: { reportId: input.reportId, reportHash: digest(report) },
    career: { careerId: input.careerId, careerName: hypothesis.title, candidateReason: hypothesis.whyConsidered },
    workValidation,
    relevantConstraints: {
      location: constraints.location.constraints.join('、') || undefined,
      incomeBoundary: constraints.income.minimumIncomeBand,
      timeCapacity: constraints.transitionCapacity.weeklyHours,
      educationTolerance: constraints.educationTolerance,
      mobility: constraints.location.mobility,
      otherBarriers: constraints.workConstraints.filter((value) => value !== 'work_constraint_none'),
    },
    relevantCareerCapital: {
      experience: [...input.calibration.careerCapital.experience],
      skills: [...input.calibration.careerCapital.skills],
      evidence: [...input.calibration.careerCapital.evidence],
    },
    marketEvidence: {
      marketStatus: approvedEvidence.length ? (hypothesis.evidenceStatus === 'verified' ? 'verified' : 'partial') : 'unavailable',
      locationLabel: constraints.location.mobility,
      sources: approvedEvidence.map((item) => ({
        sourceType: item.sourceType,
        sourceName: item.source || item.title,
        sourceUrl: item.url,
        retrievedAt: input.reportCapturedAt,
        fact: item.fact,
      })),
      limitationNote: approvedEvidence.length
        ? '来源于服务端已接受的报告证据；记录时间不是来源发表时间，资格门槛仍需逐项核实。'
        : '当前没有服务端认可的岗位来源，不能据此断言招聘事实或岗位资格。',
    },
    frozenAt: input.frozenAt,
  });
}

export function buildChildSnapshot(parent: CareerValidationSession, childId: string, frozenAt: string): ValidationContextSnapshot {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(childId) || childId === parent.id) throw new Error('Invalid child identity');
  if (parent.status !== 'completed' || !parent.validationContextSnapshot || !parent.result
    || parent.result.nextAction.type !== 'in_product_experiment' || !parent.result.nextAction.canStartInProduct) {
    throw new Error('Parent does not permit an in-product experiment');
  }
  const base = ValidationContextSnapshotSchema.omit({ contextHash: true, parentResultSummary: true })
    .parse(parent.validationContextSnapshot);
  return finalizeSnapshot({
    ...structuredClone(base),
    parentResultSummary: {
      parentValidationSessionId: parent.id,
      validatedQuestion: parent.result.validatedQuestion,
      status: parent.result.status,
      evidenceSummary: parent.result.supportingEvidence.slice(0, 5),
      unknowns: parent.result.unknowns.slice(0, 5),
      requestedNextActionType: 'in_product_experiment',
    },
    frozenAt,
  });
}
