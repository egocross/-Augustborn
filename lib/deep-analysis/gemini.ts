import 'server-only';

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';

import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_REASONING_EFFORT, type GeminiReasoningEffort } from '@/lib/gemini/config';
import { toGeminiResponseSchema } from '@/lib/gemini/json-schema';
import {
  CareerAnalysisInputSchema,
  createCareerAnalysisInput,
  createCareerResearchContext,
  type CareerGenerationRequest,
  type CareerMarketEvidence,
} from './career-pipeline';
import { createCareerReportPrompt } from './prompts/career';
import { createCareerValidationPrompt } from './prompts/career-validation';
import {
  researchCareerValidation,
  type CareerValidationResearch,
} from './research/career-validation';
import { researchCareerMarket } from './research/jobs';
import {
  CareerHypothesisSchema,
  CareerReportSchema,
  CareerWorkValidationSchema,
  type CareerReport,
  type CareerWorkValidation,
  type DeepReport,
} from './types';

const DEFAULT_MODEL = 'gemini-3.1-pro-preview';
const THINKING_LEVELS: Record<GeminiReasoningEffort, ThinkingLevel> = {
  low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH,
};

export type DeepAnalysisErrorCode = 'timeout' | 'upstream_failed' | 'parse_failed';
export class DeepAnalysisError extends Error {
  constructor(public readonly code: DeepAnalysisErrorCode) {
    super(code);
    this.name = 'DeepAnalysisError';
  }
}

/**
 * The first generation stage only produces candidate directions; the per-career
 * work validation is generated afterwards, so the request never advertises it.
 * Asking for it made the model emit partial validation blocks that failed parsing.
 */
const CareerCandidateReportSchema = CareerReportSchema.extend({
  careerHypotheses: z.array(CareerHypothesisSchema.omit({ workValidation: true })).min(3).max(5),
});

const config = (signal?: AbortSignal) => ({
  responseMimeType: 'application/json',
  responseJsonSchema: toGeminiResponseSchema(CareerCandidateReportSchema),
  thinkingConfig: { thinkingLevel: THINKING_LEVELS[GEMINI_REASONING_EFFORT] },
  ...(signal ? { abortSignal: signal } : {}),
});

const validationConfig = (signal?: AbortSignal) => ({
  responseMimeType: 'application/json',
  responseJsonSchema: toGeminiResponseSchema(CareerWorkValidationSchema),
  thinkingConfig: { thinkingLevel: THINKING_LEVELS[GEMINI_REASONING_EFFORT] },
  ...(signal ? { abortSignal: signal } : {}),
});

const mapError = (error: unknown): never => {
  if (error instanceof DeepAnalysisError) throw error;
  if (error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))) {
    throw new DeepAnalysisError('timeout');
  }
  const raw = error instanceof Error ? error : new Error(String(error));
  const status = (error as { status?: unknown } | null)?.status;
  console.error('deep_analysis_upstream_error', {
    name: raw.name,
    message: raw.message.slice(0, 300),
    ...(typeof status === 'number' ? { status } : {}),
  });
  throw new DeepAnalysisError('upstream_failed');
};

function attachVerifiedSources(report: CareerReport, market: CareerMarketEvidence): CareerReport {
  const allowed = new Map(market.sources.map((source) => [source.url, source]));
  const hypotheses = report.careerHypotheses.map((hypothesis) => {
    const sources = hypothesis.sources
      .map((source) => allowed.get(source.url))
      .filter((source): source is NonNullable<typeof source> => Boolean(source))
      .slice(0, 5)
      .map((source) => ({
        title: source.title,
        url: source.url,
        site: source.site,
        excerpt: source.excerpt,
      }));
    const evidenceStatus = sources.length >= 2 ? 'verified' : sources.length ? 'partial' : 'unavailable';
    return {
      ...hypothesis,
      sources,
      sourceCount: sources.length,
      evidenceStatus,
      marketEvidenceSummary: sources.length
        ? hypothesis.marketEvidenceSummary
        : '没有通过服务端校验的招聘来源，市场可行性待验证。',
    };
  });
  return CareerReportSchema.parse({
    ...report,
    careerHypotheses: hypotheses,
    marketStatus: market.status === 'sample' ? 'sample' : market.status,
  });
}

const unavailableResearch = (careerName: string): CareerValidationResearch => ({
  careerName,
  checkedAt: new Date().toISOString(),
  queries: [`${careerName} 岗位职责 JD 中国`],
  evidence: [],
  status: 'unavailable',
  confidence: 'low',
  note: '当前公开信息不足，建议把“真实岗位访谈 / JD 核实”作为第一验证动作。',
  cacheStatus: 'miss',
  failure: 'unavailable',
});

function evidenceCheckAction(careerName: string): CareerWorkValidation['validationPath'][number] {
  return {
    level: 'work_reality',
    title: '先核对真实岗位与从业信息',
    validates: `你对“${careerName}”核心任务与入场门槛的理解是否符合当前中国市场。`,
    steps: ['收集 5–10 条近期真实 JD', '标出反复出现的任务、交付物与门槛', '找一名从业者或招聘者核对差异'],
    estimatedTime: '1–2 小时',
    estimatedCost: '基本免费',
    deliverable: '一页岗位共性、差异与待确认问题清单',
    successSignals: ['能清楚说出最高频任务、主要门槛和自己不能接受的部分'],
    stopSignals: ['多数真实岗位的核心任务或硬门槛都与现实约束冲突'],
  };
}

function unavailableValidation(careerName: string, reason: string): CareerWorkValidation {
  return CareerWorkValidationSchema.parse({
    careerId: `career-${careerName}`,
    careerName,
    status: 'unavailable',
    note: reason,
    workReality: {
      coreTasks: ['当前公开信息不足，核心任务需要通过真实 JD 或从业者访谈核实'],
      deliverables: ['待核实该岗位的真实交付物'],
      performanceSignals: ['具体考核方式因公司与岗位层级而异，当前不补造结论'],
      collaborationWith: ['待通过真实岗位信息核实'],
      overlookedReality: ['同名岗位在不同公司的职责边界可能明显不同'],
      evidence: [],
      confidence: 'low',
    },
    capabilitySignals: {
      hiringSignalType: 'mixed',
      existingSignals: [],
      criticalGaps: [{
        gap: '缺少可核实的岗位门槛与能力证明信息',
        impact: '目前不能可靠判断招聘者最看重哪种入场信号。',
        basis: 'model_judgment',
      }],
      fastBuildableSignals: [],
      hardBarriers: [],
      bridgePaths: [],
    },
    validationPath: [
      evidenceCheckAction(careerName),
      {
        level: 'market_test',
        title: '带着核对清单询问一名从业者',
        validates: '公开职位描述与真实日常工作之间有哪些差异。',
        steps: ['选择一名当前从业者或招聘者', '发送 3 个关于高频任务、压力和门槛的问题', '记录回答并修正岗位清单'],
        estimatedTime: '半天内',
        estimatedCost: '基本免费',
        deliverable: '一份真实岗位访谈记录',
        successSignals: ['至少获得一条能改变或确认判断的外部反馈'],
      },
    ],
  });
}

function attachValidationEvidence(
  modelValue: unknown,
  careerName: string,
  research: CareerValidationResearch,
): CareerWorkValidation {
  const parsed = CareerWorkValidationSchema.parse(modelValue);
  let validationPath = parsed.validationPath;
  if (!research.evidence.length && !/JD|岗位|从业|招聘/.test(validationPath[0]?.title ?? '')) {
    validationPath = [evidenceCheckAction(careerName), ...validationPath].slice(0, 4);
  }
  return CareerWorkValidationSchema.parse({
    ...parsed,
    careerId: `career-${careerName}`,
    careerName,
    status: research.status === 'verified' ? 'complete' : 'partial',
    note: research.note,
    workReality: {
      ...parsed.workReality,
      evidence: research.evidence,
      confidence: research.confidence,
    },
    capabilitySignals: {
      ...parsed.capabilitySignals,
      hardBarriers: parsed.capabilitySignals.hardBarriers.map((barrier) => ({
        ...barrier,
        // The current contract does not carry a source id per barrier. An official
        // source elsewhere in the research bundle is not proof of this exact claim.
        evidenceStatus: barrier.evidenceStatus === 'verified' ? 'uncertain' as const : barrier.evidenceStatus,
      })),
    },
    validationPath,
  });
}

async function enrichCareerValidations(
  report: CareerReport,
  request: CareerGenerationRequest,
  ai: GoogleGenAI,
  context: ReturnType<typeof createCareerResearchContext>,
  options: { signal?: AbortSignal; onStage?: (stage: string) => void },
): Promise<CareerReport> {
  options.onStage?.('work_reality');
  const researchByCareer = await Promise.all(report.careerHypotheses.map(async (hypothesis) => {
    options.signal?.throwIfAborted();
    try {
      return await researchCareerValidation(hypothesis.title, context, options);
    } catch {
      options.signal?.throwIfAborted();
      return unavailableResearch(hypothesis.title);
    }
  }));

  options.onStage?.('capability_signals');
  const careerHypotheses = await Promise.all(report.careerHypotheses.map(async (hypothesis, index) => {
    const research = researchByCareer[index];
    options.signal?.throwIfAborted();
    try {
      const result = await ai.models.generateContent({
        model: GEMINI_MODEL ?? DEFAULT_MODEL,
        contents: createCareerValidationPrompt({
          hypothesis,
          careerCapital: request.careerCalibration.careerCapital,
          hardConstraints: request.careerCalibration.hardConstraints,
          research,
        }),
        config: validationConfig(options.signal),
      });
      if (!result.text) throw new Error('empty_career_validation');
      return {
        ...hypothesis,
        workValidation: attachValidationEvidence(JSON.parse(result.text), hypothesis.title, research),
      };
    } catch {
      options.signal?.throwIfAborted();
      return {
        ...hypothesis,
        workValidation: unavailableValidation(
          hypothesis.title,
          '这个单个职业的验证暂时没有生成完成；其他职业仍可继续查看，建议先用真实 JD 与从业者访谈核实。',
        ),
      };
    }
  }));
  options.onStage?.('validation_paths');
  return CareerReportSchema.parse({ ...report, careerHypotheses });
}

export async function* generateCareerReportStream(
  request: CareerGenerationRequest,
  options: { signal?: AbortSignal; onStage?: (stage: string) => void } = {},
): AsyncGenerator<string, DeepReport | undefined> {
  const startedAt = Date.now();
  try {
    const preliminary = createCareerAnalysisInput(request.baseReport, request.careerCalibration);
    options.onStage?.('market_research');
    const market = await researchCareerMarket(createCareerResearchContext(preliminary), options);
    console.warn('deep_report_market_ready', {
      status: market.status,
      sources: market.sources.length,
      ms: Date.now() - startedAt,
    });
    options.signal?.throwIfAborted();
    const input = CareerAnalysisInputSchema.parse({ ...preliminary, marketEvidence: market });
    options.onStage?.('candidate_analysis');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.warn('deep_report_stream_started', {
      model: GEMINI_MODEL ?? DEFAULT_MODEL,
      promptChars: createCareerReportPrompt(input).length,
      ms: Date.now() - startedAt,
    });
    const stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL ?? DEFAULT_MODEL,
      contents: createCareerReportPrompt(input),
      config: config(options.signal),
    });
    let text = '';
    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount += 1;
      if (chunk.text) {
        text += chunk.text;
        yield chunk.text;
      }
    }
    if (!text) {
      console.error('deep_report_empty_stream', { chunkCount, ms: Date.now() - startedAt });
      throw new DeepAnalysisError('upstream_failed');
    }
    const draft = CareerCandidateReportSchema.parse(JSON.parse(text));
    const candidates = attachVerifiedSources(draft, market);
    return await enrichCareerValidations(
      candidates,
      request,
      ai,
      createCareerResearchContext(input),
      options,
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      console.error('deep_report_parse_failed', {
        ms: Date.now() - startedAt,
        detail: error instanceof z.ZodError
          ? JSON.stringify(error.issues.slice(0, 3)).slice(0, 400)
          : error.message.slice(0, 200),
      });
      throw new DeepAnalysisError('parse_failed');
    }
    return mapError(error);
  }
}
