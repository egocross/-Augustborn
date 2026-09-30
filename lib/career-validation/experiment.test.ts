import { describe, expect, it, vi } from 'vitest';

import { CareerValidationSessionSchema, type CareerValidationSession } from './schema';
import { generateCareerExperiment, createFallbackExperiment } from './experiment';
import { createExperimentPrompt } from './prompts';

const fixture = () => {
  const source = {
    id: '123e4567-e89b-42d3-a456-426614174001', reportId: '123e4567-e89b-42d3-a456-426614174000', careerId: 'career-1',
    parentValidationSessionId: null, status: 'created', validationContextSnapshot: {
      version: 1, contextHash: 'a'.repeat(64), sourceReport: { reportId: '123e4567-e89b-42d3-a456-426614174000' },
      career: { careerId: 'career-1', careerName: '内容策划', candidateReason: '探索性候选' },
      workValidation: {
        careerId: 'career-1', careerName: '内容策划', status: 'complete',
        workReality: { coreTasks: ['梳理需求', '撰写方案'], deliverables: ['一页方案'], performanceSignals: ['清楚表达'], collaborationWith: ['设计师'], overlookedReality: ['需要反复修改'], evidence: [], confidence: 'low' },
        capabilitySignals: { hiringSignalType: 'portfolio_project', existingSignals: [], criticalGaps: [{ gap: '缺少作品', impact: '难以证明', basis: 'model_judgment' }], fastBuildableSignals: [], hardBarriers: [], bridgePaths: [] },
        validationPath: [{ level: 'job_simulation', title: '写一页方案', validates: '是否愿意反复打磨内容', steps: ['阅读材料', '梳理信息', '写出方案'], estimatedTime: '60分钟', estimatedCost: '0元', deliverable: '一页方案', successSignals: ['结构清楚'] }, { level: 'real_evidence', title: '请人评阅', validates: '外部认可', steps: ['找人', '展示', '记录'], estimatedTime: '一周', estimatedCost: '0元', deliverable: '反馈', successSignals: ['有建议'] }],
      },
      relevantConstraints: {}, relevantCareerCapital: { experience: [], skills: [], evidence: [] },
      marketEvidence: { marketStatus: 'unavailable', locationLabel: 'mobility_nationwide', sources: [], limitationNote: '没有可信来源' },
      frozenAt: '2026-10-01T00:00:00.000Z',
    }, experiment: null, experimentVersion: null, submission: null, reflection: null, result: null,
    generationMetadata: null, revision: 1, operationKind: null, operationToken: null, operationLeaseExpiresAt: null,
    capabilityIssuedAt: '2026-10-01T00:00:00.000Z', capabilityExpiresAt: '2026-10-02T00:00:00.000Z',
    retentionExpiresAt: '2027-01-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z', deletedAt: null,
  };
  return CareerValidationSessionSchema.parse(source);
};

describe('career experiment', () => {
  it('passes only the frozen snapshot to the model and rejects reflection prompts', async () => {
    const session = fixture();
    const model = vi.fn(async () => ({ ...createFallbackExperiment(session).draft, reflectionPrompts: ['AI problem'] }));
    const result = await generateCareerExperiment(session, undefined, { model, provider: 'gemini', now: '2026-10-01T00:10:00.000Z' });
    expect(model).toHaveBeenCalledWith(expect.stringContaining(session.validationContextSnapshot!.contextHash), expect.anything());
    expect(createExperimentPrompt(session)).not.toContain('publicResultUrl');
    expect(result.generationMetadata.experimentModelId).toBe('deterministic-fallback');
  });

  it('uses a complete safe plan for a deterministic task', () => {
    const result = createFallbackExperiment(fixture());
    expect(result.draft.executionMode).toBe('online_work_sample');
    expect(result.draft.steps).toHaveLength(3);
    expect(result.draft).not.toHaveProperty('reflectionPrompts');
  });

  it('uses job reality review with 1–3 trusted sources when task data is incomplete', () => {
    const session = fixture();
    const snapshot = session.validationContextSnapshot!;
    const changed = { ...session, validationContextSnapshot: {
      ...snapshot, workValidation: { ...snapshot.workValidation, status: 'partial' as const },
      marketEvidence: { ...snapshot.marketEvidence, marketStatus: 'partial' as const, sources: [{ sourceType: 'job_posting', sourceName: '官方招聘', sourceUrl: 'https://example.com/job', retrievedAt: '2026-10-01T00:00:00.000Z', fact: '需要整理需求' }] },
    } } as CareerValidationSession;
    expect(createFallbackExperiment(changed).draft.executionMode).toBe('job_reality_review');
  });

  it('uses core-work awareness with no trusted source and never asserts a hiring fact', () => {
    const session = fixture();
    const snapshot = session.validationContextSnapshot!;
    const changed = { ...session, validationContextSnapshot: { ...snapshot, workValidation: { ...snapshot.workValidation, status: 'unavailable' as const } } } as CareerValidationSession;
    const result = createFallbackExperiment(changed);
    expect(result.draft.executionMode).toBe('core_work_awareness');
    expect(result.draft.limitationNote).toContain('实时岗位证据不足');
  });
});
