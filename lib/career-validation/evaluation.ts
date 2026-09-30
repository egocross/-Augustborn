import 'server-only';

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';

import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_REASONING_EFFORT } from '@/lib/gemini/config';
import { usesSampleReports } from '@/lib/report-provider/config';

import { createEvaluationPrompt, EVALUATION_PROMPT_VERSION, RUBRIC_VERSION } from './prompts';
import { ValidationResultDraftSchema, ValidationResultSchema, type CareerValidationSession, type EvidenceItem, type ValidationResult, type ValidationResultDraft } from './schema';

const modelId = GEMINI_MODEL ?? 'gemini-3.1-pro-preview';
const levels = { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH };
const dimensions = ['task_performance', 'work_experience_feeling', 'learning_response', 'real_world_feasibility', 'external_feedback'] as const;

function validateEvidenceDraft(value: unknown): ValidationResultDraft {
  const draft = ValidationResultDraftSchema.parse(value);
  const actual = draft.evidence.map((item) => item.dimension);
  if (actual.length !== dimensions.length || dimensions.some((dimension) => actual.filter((item) => item === dimension).length !== 1)) {
    throw new Error('invalid_evidence_dimensions');
  }
  if (draft.evidence.find((item) => item.dimension === 'external_feedback')?.signal !== 'no_evidence') {
    throw new Error('unverified_external_feedback');
  }
  const rendered = JSON.stringify(draft);
  if (/验证通过|你不适合|匹配度|\d+\s*%/.test(rendered)) throw new Error('overstated_evaluation');
  return draft;
}

export function createSampleValidationResult(session: CareerValidationSession): ValidationResultDraft {
  if (!session.experiment || !session.submission || !session.reflection) throw new Error('incomplete_validation_submission');
  const reflection = session.reflection;
  const feelingRisk = reflection.engagement === 'draining' || reflection.repeatWillingness === 'unwilling';
  const evidence: EvidenceItem[] = [
    { dimension: 'task_performance', signal: 'mixed', observation: '用户提交了文字成果，但未经过独立评审。', interpretation: '可据此讨论任务完成过程，不能推断真实岗位表现。', limitation: '没有外部质量评价。' },
    { dimension: 'work_experience_feeling', signal: feelingRisk ? 'risk' : 'mixed', observation: feelingRisk ? '复盘显示投入感较低或不愿重复。' : '复盘未显示明显排斥。', interpretation: '主观体验应与任务质量分开看。', limitation: '一次短任务不代表长期工作体验。' },
    { dimension: 'learning_response', signal: 'no_evidence', observation: '本轮没有多次迭代记录。', interpretation: '无法判断持续学习速度。', limitation: '需再次尝试或收集反馈。' },
    { dimension: 'real_world_feasibility', signal: 'no_evidence', observation: '实验未验证真实招聘与入场条件。', interpretation: '现实可行性尚未确定。', limitation: '需要实际岗位或从业者证据。' },
    { dimension: 'external_feedback', signal: 'no_evidence', observation: '没有独立外部反馈。', interpretation: '公开链接或自述不能替代反馈。', limitation: '尚未获得招聘方、客户或从业者评价。' },
  ];
  return validateEvidenceDraft({
    status: 'insufficient_evidence', validatedQuestion: session.experiment.validationQuestion,
    evidence, supportingEvidence: ['已提交一份可复盘的文字成果。'],
    riskSignals: feelingRisk ? ['这次任务的主观体验值得进一步核对。'] : [],
    unknowns: ['真实岗位中的任务是否一致？', '外部评审会如何评价成果？'],
    reasoning: '这份材料只覆盖一次小实验。任务表现和工作体验是不同信号，目前外部质量、长期学习与市场条件都缺证据，因此不扩大为职业适配判断。',
    nextAction: { type: 'external_validation', title: '找真实从业者核对工作内容', detail: '带着作品与三个具体问题，请一位从业者指出真实任务、入场要求和作品缺口；此行动在线下完成。', estimatedMinutes: 30, cost: '可能为零', canStartInProduct: false },
  });
}

async function callGemini(prompt: string, options: { signal?: AbortSignal }): Promise<unknown> {
  if (!GEMINI_API_KEY) throw new Error('gemini_api_key_missing');
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: modelId, contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: z.toJSONSchema(ValidationResultDraftSchema, { target: 'openapi-3.0' }),
      thinkingConfig: { thinkingLevel: levels[GEMINI_REASONING_EFFORT] },
      ...(options.signal ? { abortSignal: options.signal } : {}),
    },
  });
  return JSON.parse(response.text ?? 'null');
}

export async function analyzeValidationSession(
  session: CareerValidationSession,
  signal?: AbortSignal,
  dependencies: { model?: typeof callGemini; provider?: 'sample' | 'gemini'; now?: string } = {},
): Promise<ValidationResult> {
  if (!session.experiment || !session.submission || !session.reflection || !session.validationContextSnapshot) throw new Error('incomplete_validation_submission');
  const sample = (dependencies.provider ?? (usesSampleReports() ? 'sample' : 'gemini')) === 'sample';
  const draft = sample ? createSampleValidationResult(session)
    : validateEvidenceDraft(await (dependencies.model ?? callGemini)(createEvaluationPrompt(session), { signal }));
  return ValidationResultSchema.parse({
    ...draft, analyzedAt: dependencies.now ?? new Date().toISOString(),
    generationMetadata: {
      evaluationPromptVersion: EVALUATION_PROMPT_VERSION, rubricVersion: RUBRIC_VERSION,
      evaluationModelId: sample ? 'deterministic-sample' : modelId,
    },
  });
}
