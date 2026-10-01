import 'server-only';

import { GoogleGenAI, ThinkingLevel } from '@google/genai';

import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_REASONING_EFFORT } from '@/lib/gemini/config';
import { toGeminiResponseSchema } from '@/lib/gemini/json-schema';
import { usesSampleReports } from '@/lib/report-provider/config';

import { CareerExperimentDraftSchema, CareerExperimentSchema, type CareerExperiment, type CareerExperimentDraft, type CareerValidationSession } from './schema';
import { createExperimentPrompt, EXPERIMENT_PROMPT_VERSION, RUBRIC_VERSION } from './prompts';

const modelId = GEMINI_MODEL ?? 'gemini-3.1-pro-preview';
const levels = { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH };
const short = (value: string, max: number) => value.slice(0, max);

type Fallback = { draft: CareerExperimentDraft; modelId: 'deterministic-fallback' };

export function createFallbackExperiment(session: CareerValidationSession): Fallback {
  const snapshot = session.validationContextSnapshot;
  if (!snapshot) throw new Error('missing_frozen_context');
  const plan = snapshot.workValidation;
  const action = plan.validationPath.find((item) => item.level === 'job_simulation');
  const barriers = plan.capabilitySignals.hardBarriers;
  const canUseTask = plan.status === 'complete' && action && action.steps.length >= 3
    && plan.workReality.coreTasks.length >= 2 && plan.workReality.performanceSignals.length > 0
    && barriers.length === 0;
  const sources = snapshot.marketEvidence.sources.slice(0, 3);
  const common = {
    id: `experiment-${session.id}`, version: 1 as const,
    hypothesis: short(`通过一项小任务观察自己对「${snapshot.career.careerName}」核心工作的反应，而不是证明最终适配。`, 800),
    role: short(`你是正在探索「${snapshot.career.careerName}」的人。`, 300),
    prerequisites: barriers.map((item) => short(`先核实资格门槛：${item.barrier}（当前未验证）`, 500)),
  };

  let draft: CareerExperimentDraft;
  if (canUseTask) {
    draft = {
      ...common, executionMode: 'online_work_sample', uncertaintyType: 'task_ability',
      validationQuestion: short(action.validates, 500), title: short(action.title, 160),
      scenario: short(`围绕「${snapshot.career.careerName}」的一项低风险工作样本；不要将成果当作真实客户交付。`, 1500),
      objective: short(action.validates, 800),
      providedInformation: plan.workReality.coreTasks.map((item) => short(item, 1000)),
      estimatedMinutes: 60, steps: action.steps.map((item) => short(item, 800)),
      deliverable: short(action.deliverable, 800),
      rubric: action.successSignals.map((item) => ({ criterion: short(item, 200), basicStandard: short(`在提交内容中清楚呈现「${item}」的具体证据。`, 500) })),
      referenceStructure: [short(action.deliverable, 500), '过程与取舍', '尚未验证的问题'],
      limitationNote: '这是低风险工作样本，不代表真实招聘要求或完整职业体验。',
    };
  } else if (sources.length) {
    draft = {
      ...common, executionMode: 'job_reality_review', uncertaintyType: 'real_world_feasibility',
      validationQuestion: '真实岗位的重复任务和入场要求是否值得继续验证？',
      title: `核对「${short(snapshot.career.careerName, 100)}」的岗位现实`,
      scenario: '仅整理冻结上下文中已经确认的1–3条来源，不访问新链接，也不假设来源覆盖整个市场。',
      objective: '识别重复任务、重复要求、最大入场缺口与最不能接受的工作内容。',
      providedInformation: sources.map((item) => short(`${item.sourceName}：${item.fact}`, 1000)),
      estimatedMinutes: 45,
      steps: ['逐条记录来源明确说了什么，不补写招聘事实。', '归纳重复任务与重复要求，区分事实和自己的推断。', '列出最大入场缺口和最不能接受的工作内容。'],
      deliverable: '一页岗位现实核对：重复任务、重复要求、最大缺口、不能接受的内容及未知。',
      rubric: [{ criterion: '事实与推断分离', basicStandard: '每条结论能指出来源或标为待核实。' }],
      referenceStructure: ['来源明确事实', '我的推断', '最大缺口', '仍未知的问题'],
      limitationNote: '仅有少量来源，不足以推断整体招聘市场；资格门槛需另行核实。',
    };
  } else {
    draft = {
      ...common, executionMode: 'core_work_awareness', uncertaintyType: 'work_content',
      validationQuestion: '我是否理解并愿意进一步接触这类工作的核心任务？',
      title: `认识「${short(snapshot.career.careerName, 100)}」的核心工作`,
      scenario: '当前实时岗位证据不足，只进行职业核心工作认知，不模拟真实招聘或专业资格服务。',
      objective: '区分已知的核心任务、个人猜测和必须向从业者求证的问题。',
      providedInformation: plan.workReality.coreTasks.map((item) => short(`报告中的待核实任务：${item}`, 1000)),
      estimatedMinutes: 30,
      steps: ['列出报告提出的核心任务，逐条标注是否已核实。', '写出每项任务可能需要的交付物及自己最不确定之处。', '整理三条要向真实从业者或公开岗位信息求证的问题。'],
      deliverable: '一页核心工作认知表：已知、推测、待求证。',
      rubric: [{ criterion: '知道哪些还不知道', basicStandard: '明确区分已确认信息和待求证假设。' }],
      referenceStructure: ['报告中的任务', '我的推测', '待求证问题'],
      limitationNote: '当前实时岗位证据不足；本实验不能证明招聘要求或职业适配。',
    };
  }
  return { draft: CareerExperimentDraftSchema.parse(draft), modelId: 'deterministic-fallback' };
}

async function callGemini(prompt: string, options: { signal?: AbortSignal }): Promise<unknown> {
  if (!GEMINI_API_KEY) throw new Error('gemini_api_key_missing');
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: modelId, contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: toGeminiResponseSchema(CareerExperimentDraftSchema),
      thinkingConfig: { thinkingLevel: levels[GEMINI_REASONING_EFFORT] },
      ...(options.signal ? { abortSignal: options.signal } : {}),
    },
  });
  return JSON.parse(response.text ?? 'null');
}

export async function generateCareerExperiment(
  session: CareerValidationSession,
  signal?: AbortSignal,
  dependencies: { model?: typeof callGemini; provider?: 'sample' | 'gemini'; now?: string } = {},
): Promise<CareerExperiment> {
  if (!session.validationContextSnapshot) throw new Error('missing_frozen_context');
  const fallback = createFallbackExperiment(session);
  let draft = fallback.draft;
  let usedModelId: string = fallback.modelId;
  if ((dependencies.provider ?? (usesSampleReports() ? 'sample' : 'gemini')) === 'gemini') {
    try {
      draft = CareerExperimentDraftSchema.parse(await (dependencies.model ?? callGemini)(createExperimentPrompt(session), { signal }));
      usedModelId = modelId;
    } catch {
      // The frozen, conservative fallback is safer than inventing a task after model failure.
    }
  }
  return CareerExperimentSchema.parse({
    ...draft, generatedAt: dependencies.now ?? new Date().toISOString(),
    generationMetadata: {
      experimentGeneratorVersion: '1', experimentPromptVersion: EXPERIMENT_PROMPT_VERSION,
      rubricVersion: RUBRIC_VERSION, experimentModelId: usedModelId,
    },
  });
}
