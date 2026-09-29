import 'server-only';

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';

import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_REASONING_EFFORT, type GeminiReasoningEffort } from '@/lib/gemini/config';
import {
  CareerAnalysisInputSchema,
  createCareerAnalysisInput,
  createCareerResearchContext,
  type CareerGenerationRequest,
  type CareerMarketEvidence,
} from './career-pipeline';
import { createCareerReportPrompt } from './prompts/career';
import { researchCareerMarket } from './research/jobs';
import { CareerReportSchema, type CareerReport, type DeepReport } from './types';

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

const config = (signal?: AbortSignal) => ({
  responseMimeType: 'application/json',
  responseJsonSchema: z.toJSONSchema(CareerReportSchema, { target: 'openapi-3.0' }),
  thinkingConfig: { thinkingLevel: THINKING_LEVELS[GEMINI_REASONING_EFFORT] },
  ...(signal ? { abortSignal: signal } : {}),
});

const mapError = (error: unknown): never => {
  if (error instanceof DeepAnalysisError) throw error;
  if (error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))) {
    throw new DeepAnalysisError('timeout');
  }
  throw new DeepAnalysisError('upstream_failed');
};

function attachVerifiedSources(report: CareerReport, market: CareerMarketEvidence): CareerReport {
  const allowed = new Map(market.sources.map((source) => [source.url, source]));
  const hypotheses = report.careerHypotheses.map((hypothesis) => {
    const sources = hypothesis.sources
      .map((source) => allowed.get(source.url))
      .filter((source): source is NonNullable<typeof source> => Boolean(source))
      .slice(0, 5)
      .map(({ evidenceId: _evidenceId, ...source }) => source);
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

export async function* generateCareerReportStream(
  request: CareerGenerationRequest,
  options: { signal?: AbortSignal; onStage?: (stage: string) => void } = {},
): AsyncGenerator<string, DeepReport | undefined> {
  try {
    const preliminary = createCareerAnalysisInput(request.baseReport, request.careerCalibration);
    options.onStage?.('researching');
    const market = await researchCareerMarket(createCareerResearchContext(preliminary), options);
    options.signal?.throwIfAborted();
    const input = CareerAnalysisInputSchema.parse({ ...preliminary, marketEvidence: market });
    options.onStage?.('converging');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL ?? DEFAULT_MODEL,
      contents: createCareerReportPrompt(input),
      config: config(options.signal),
    });
    let text = '';
    for await (const chunk of stream) {
      if (chunk.text) {
        text += chunk.text;
        yield chunk.text;
      }
    }
    if (!text) throw new DeepAnalysisError('upstream_failed');
    return attachVerifiedSources(CareerReportSchema.parse(JSON.parse(text)), market);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new DeepAnalysisError('parse_failed');
    }
    return mapError(error);
  }
}
