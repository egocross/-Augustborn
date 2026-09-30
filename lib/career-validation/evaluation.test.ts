import { describe, expect, it, vi } from 'vitest';

import type { CareerValidationSession, ValidationResultDraft } from './schema';
import { analyzeValidationSession, createSampleValidationResult } from './evaluation';
import { createEvaluationPrompt } from './prompts';

const session = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  validationContextSnapshot: {
    relevantConstraints: { incomeBoundary: 'minimum_income_3000_5000' },
    workValidation: { capabilitySignals: { hardBarriers: [] } },
    parentResultSummary: undefined,
  },
  experiment: { validationQuestion: '能否完成策划工作样本？', rubric: [{ criterion: '结构清楚', basicStandard: '有清晰分段' }], title: '方案练习' },
  submission: { format: 'markdown', content: '我完成了方案，先列出目标、受众，再整理交付步骤和风险。', publicResultUrl: 'https://example.com/private', attachments: [] },
  reflection: { engagement: 'draining', persistence: 'forced_continue', repeatWillingness: 'unwilling', difficulty: 'manageable' },
} as unknown as CareerValidationSession;

describe('evidence evaluation', () => {
  it('only sends the current task, Markdown, reflection and necessary frozen barriers', () => {
    const prompt = createEvaluationPrompt(session);
    expect(prompt).toContain('能否完成策划工作样本');
    expect(prompt).toContain(session.submission!.content);
    expect(prompt).not.toContain('https://example.com/private');
    expect(prompt).not.toContain('publicResultUrl');
    expect(prompt).not.toContain('attachments');
  });

  it('keeps task performance and felt experience as independent evidence', () => {
    const result = createSampleValidationResult(session);
    expect(result.evidence.find((item) => item.dimension === 'task_performance')?.signal).toBe('mixed');
    expect(result.evidence.find((item) => item.dimension === 'work_experience_feeling')?.signal).toBe('risk');
    expect(result.evidence.find((item) => item.dimension === 'external_feedback')?.signal).toBe('no_evidence');
    expect(result.nextAction.canStartInProduct).toBe(false);
  });

  it('does not accept incomplete or invented feedback from the model', async () => {
    const draft = createSampleValidationResult(session);
    const model = vi.fn(async () => ({ ...draft, evidence: draft.evidence.map((item) => item.dimension === 'external_feedback' ? { ...item, signal: 'support' } : item) } as ValidationResultDraft));
    await expect(analyzeValidationSession(session, undefined, { provider: 'gemini', model })).rejects.toThrow();
  });

  it('does not fabricate a production result when the model fails', async () => {
    const model = vi.fn(async () => { throw new Error('upstream'); });
    await expect(analyzeValidationSession(session, undefined, { provider: 'gemini', model })).rejects.toThrow('upstream');
  });
});
