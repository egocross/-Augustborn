import { describe, expect, it } from 'vitest';

import {
  CareerExperimentDraftSchema,
  CareerExperimentSchema,
  ReflectionSchema,
  SubmissionSchema,
  ValidationNextActionSchema,
  ValidationResultDraftSchema,
} from './schema';

const experimentDraft = {
  id: 'exp-1',
  version: 1,
  executionMode: 'job_reality_review',
  validationQuestion: '这个岗位每天真正做什么？',
  uncertaintyType: 'work_content',
  hypothesis: '实际工作可能与想象不同',
  title: '核对岗位日常',
  scenario: '你正在考虑一个内容策划岗位',
  role: '候选人',
  objective: '识别高频工作与入场门槛',
  providedInformation: ['一条已核验岗位来源'],
  prerequisites: ['公开职位描述'],
  estimatedMinutes: 60,
  steps: ['核对三条真实职位描述', '整理共同任务', '记录尚未证实的门槛'],
  deliverable: '一页岗位核对表',
  rubric: [{ criterion: '任务识别', basicStandard: '至少列出三项高频任务' }],
  referenceStructure: ['共同任务', '待核实门槛'],
};

const nextAction = {
  type: 'external_validation', title: '找从业者核实', detail: '核对一项主要未知',
  cost: '免费', canStartInProduct: false,
};

describe('validator contracts', () => {
  it('rejects model-generated reflection questions and unknown experiment fields', () => {
    expect(CareerExperimentDraftSchema.safeParse({ ...experimentDraft, reflectionPrompts: ['你喜欢吗？'] }).success).toBe(false);
    expect(CareerExperimentSchema.safeParse({
      ...experimentDraft, reflectionPrompts: ['你喜欢吗？'], generatedAt: '2026-09-30T00:00:00.000Z',
      generationMetadata: {
        experimentGeneratorVersion: '1', experimentPromptVersion: '1', rubricVersion: '1', experimentModelId: 'sample',
      },
    }).success).toBe(false);
    expect(CareerExperimentDraftSchema.safeParse(experimentDraft).success).toBe(true);
  });

  it('requires all four fixed reflection answers', () => {
    const valid = {
      engagement: 'time_flew', persistence: 'naturally_continued', repeatWillingness: 'willing', difficulty: 'manageable',
    };
    expect(ReflectionSchema.safeParse(valid).success).toBe(true);
    expect(ReflectionSchema.safeParse({ ...valid, difficulty: undefined }).success).toBe(false);
    expect(ReflectionSchema.safeParse({ ...valid, engagement: 'inspired' }).success).toBe(false);
  });

  it('bounds Markdown and saves only HTTPS public links with no attachments', () => {
    const valid = { format: 'markdown', content: '我完成了岗位任务，并记录了主要判断过程和交付结果。', attachments: [] };
    expect(SubmissionSchema.safeParse(valid).success).toBe(true);
    expect(SubmissionSchema.safeParse({ ...valid, content: '太短' }).success).toBe(false);
    expect(SubmissionSchema.safeParse({ ...valid, content: 'a'.repeat(30_001) }).success).toBe(false);
    expect(SubmissionSchema.safeParse({ ...valid, publicResultUrl: 'http://example.com' }).success).toBe(false);
    expect(SubmissionSchema.safeParse({ ...valid, publicResultUrl: 'https://example.com/result' }).success).toBe(true);
    expect(SubmissionSchema.safeParse({ ...valid, attachments: ['file.pdf'] }).success).toBe(false);
  });

  it('allows starting a child only for an in-product action', () => {
    expect(ValidationNextActionSchema.safeParse(nextAction).success).toBe(true);
    expect(ValidationNextActionSchema.safeParse({ ...nextAction, canStartInProduct: true }).success).toBe(false);
    expect(ValidationNextActionSchema.safeParse({ ...nextAction, type: 'in_product_experiment', canStartInProduct: true }).success).toBe(true);
  });

  it('rejects extra model result fields rather than storing them', () => {
    const draft = {
      status: 'insufficient_evidence', validatedQuestion: '是否接受主要日常任务？',
      evidence: [{ dimension: 'external_feedback', signal: 'no_evidence', observation: '尚未征询外部意见', interpretation: '无法判断外部接受度', limitation: '只有自评' }],
      supportingEvidence: [], riskSignals: [], unknowns: ['实际岗位反馈'], reasoning: '目前只有一次工作样本。',
      nextAction,
    };
    expect(ValidationResultDraftSchema.safeParse(draft).success).toBe(true);
    expect(ValidationResultDraftSchema.safeParse({ ...draft, passRate: 99 }).success).toBe(false);
  });
});
