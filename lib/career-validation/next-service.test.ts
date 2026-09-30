import { describe, expect, it, vi } from 'vitest';

import type { CareerValidationSession, ValidationNextAction } from './schema';
import { createNextValidationSession } from './next-service';

const parentId = '123e4567-e89b-42d3-a456-426614174001';
const secret = 'a-strong-secret-with-at-least-32-characters';
const snapshot = {
  version: 1, contextHash: 'a'.repeat(64), sourceReport: { reportId: '123e4567-e89b-42d3-a456-426614174000' },
  career: { careerId: 'career-1', careerName: '内容策划', candidateReason: '探索性候选' },
  workValidation: {
    careerId: 'career-1', careerName: '内容策划', status: 'unavailable',
    workReality: { coreTasks: ['梳理需求'], deliverables: ['方案'], performanceSignals: ['清楚表达'], collaborationWith: ['设计师'], overlookedReality: ['反复修改'], evidence: [], confidence: 'low' },
    capabilitySignals: { hiringSignalType: 'portfolio_project', existingSignals: [], criticalGaps: [{ gap: '缺少作品', impact: '难以证明', basis: 'model_judgment' }], fastBuildableSignals: [], hardBarriers: [], bridgePaths: [] },
    validationPath: [
      { level: 'job_simulation', title: '写方案', validates: '任务体验', steps: ['读材料', '列要点', '写方案'], estimatedTime: '一小时', estimatedCost: '0元', deliverable: '方案', successSignals: ['清楚'] },
      { level: 'real_evidence', title: '评阅', validates: '外部反馈', steps: ['找人', '展示', '记录'], estimatedTime: '一周', estimatedCost: '0元', deliverable: '反馈', successSignals: ['有建议'] },
    ],
  },
  relevantConstraints: {}, relevantCareerCapital: { experience: [], skills: [], evidence: [] },
  marketEvidence: { marketStatus: 'unavailable', locationLabel: '全国', sources: [], limitationNote: '证据不足' },
  frozenAt: '2026-10-01T00:00:00.000Z',
};

function fixture(type: ValidationNextAction['type'] = 'in_product_experiment', canStartInProduct = true) {
  const parent = {
    id: parentId, reportId: '123e4567-e89b-42d3-a456-426614174000', careerId: 'career-1', status: 'completed',
    validationContextSnapshot: snapshot,
    result: {
      status: 'insufficient_evidence', validatedQuestion: '值得继续了解吗？', supportingEvidence: ['提交过成果'], unknowns: ['真实反馈'],
      nextAction: { type, canStartInProduct, title: '下一步', detail: '详情', cost: '0元' },
    },
  } as unknown as CareerValidationSession;
  let child: CareerValidationSession | null = null;
  const repository = { createChild: vi.fn(async (value: CareerValidationSession) => { child ??= value; return child; }) };
  const getParent = vi.fn(async () => parent);
  const options = { getParent, repository, secret, now: Date.parse('2026-10-01T00:00:00.000Z'), ttlSeconds: 3600, retentionDays: 180 };
  return { parent, repository, options };
}

describe('next validation round', () => {
  it.each(['external_validation', 'market_contact', 'bridge_path', 'credential_check', 'real_project', 'pause'] as const)('does not create a child for %s', async (type) => {
    const { options, repository } = fixture(type, false);
    await expect(createNextValidationSession('parent-token', options)).rejects.toMatchObject({ code: 'NEXT_ACTION_NOT_IN_PRODUCT' });
    expect(repository.createChild).not.toHaveBeenCalled();
  });

  it('requires the explicit product-action flag', async () => {
    const { options } = fixture('in_product_experiment', false);
    await expect(createNextValidationSession('parent-token', options)).rejects.toMatchObject({ code: 'NEXT_ACTION_NOT_IN_PRODUCT' });
  });

  it('creates one child and returns identical capability on retry', async () => {
    const { options, repository } = fixture();
    const first = await createNextValidationSession('parent-token', options);
    const second = await createNextValidationSession('parent-token', { ...options, now: options.now + 1000 });
    expect(second).toEqual(first);
    expect(repository.createChild).toHaveBeenCalledTimes(2);
    const child = repository.createChild.mock.calls[0][0];
    expect(child.parentValidationSessionId).toBe(parentId);
    expect(child.validationContextSnapshot?.parentResultSummary?.unknowns).toEqual(['真实反馈']);
    expect(child.validationContextSnapshot?.parentResultSummary).not.toHaveProperty('nextAction');
  });
});
