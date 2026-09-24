import 'server-only';

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';

import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_REASONING_EFFORT, type GeminiReasoningEffort } from '@/lib/gemini/config';
import { createDeepPrompt, type DeepPromptInput } from './prompts';
import { DeepReportSchema, DynamicQuestionSchema, type DeepReport, type DynamicQuestion } from './types';
import { buildJobResearch, researchWorkJobs } from './research/jobs';

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

const dynamicQuestionsEnvelope = z.object({ questions: z.array(DynamicQuestionSchema).max(5) });

export function parseDynamicQuestions(value: unknown): DynamicQuestion[] {
  const parsed = dynamicQuestionsEnvelope.parse({ questions: value });
  if (parsed.questions.length !== 0 && (parsed.questions.length < 3 || parsed.questions.length > 5)) {
    throw new z.ZodError([]);
  }
  return parsed.questions;
}

const dynamicQuestionsResponseSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array', minItems: 0, maxItems: 5,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, type: { type: 'string', enum: ['single', 'multi'] },
          text: { type: 'string' }, required: { type: 'boolean' },
          maxSelect: { type: 'integer' },
          options: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' } }, required: ['id', 'label'] } },
        },
        required: ['id', 'type', 'text', 'required', 'options'],
      },
    },
  },
  required: ['questions'],
} as const;

const deepReportResponseSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' }, summary: { type: 'string' },
    keyFindings: { type: 'array', items: { type: 'string' } },
    cards: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' }, details: { type: 'array', items: { type: 'string' } }, evidence: { type: 'array', items: { type: 'string' } } }, required: ['id', 'title', 'summary', 'details', 'evidence'] } },
    risks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, detail: { type: 'string' }, mitigation: { type: 'string' } }, required: ['title', 'detail', 'mitigation'] } },
    nextActions: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, detail: { type: 'string' }, timeframe: { type: 'string' } }, required: ['title', 'detail', 'timeframe'] } },
    reflectionQuestions: { type: 'array', items: { type: 'string' } }, disclaimer: { type: 'string' },
  },
  required: ['title', 'summary', 'keyFindings', 'cards', 'risks', 'nextActions', 'reflectionQuestions', 'disclaimer'],
} as const;

const config = (responseJsonSchema: object, signal?: AbortSignal) => ({
  responseMimeType: 'application/json', responseJsonSchema,
  thinkingConfig: { thinkingLevel: THINKING_LEVELS[GEMINI_REASONING_EFFORT] },
  ...(signal ? { abortSignal: signal } : {}),
});

const workReportResponseSchema = {
  ...deepReportResponseSchema,
  properties: {
    ...deepReportResponseSchema.properties,
    jobRecommendations: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object',
        properties: {
          evidenceId: { type: 'string' }, title: { type: 'string' },
          searchKeywords: { type: 'array', items: { type: 'string' } },
          fitReason: { type: 'string' }, entryGap: { type: 'string' }, nextStep: { type: 'string' },
        },
        required: ['evidenceId', 'title', 'searchKeywords', 'fitReason', 'entryGap', 'nextStep'],
      },
    },
  },
  required: [...deepReportResponseSchema.required, 'jobRecommendations'],
};

const mapError = (error: unknown): never => {
  if (error instanceof DeepAnalysisError) throw error;
  if (error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))) {
    throw new DeepAnalysisError('timeout');
  }
  throw new DeepAnalysisError('upstream_failed');
};

export async function generateCustomQuestions(
  input: { customQuestion: string; freeReportSummary: { sections: unknown[] } },
  options: { signal?: AbortSignal } = {},
): Promise<DynamicQuestion[]> {
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL ?? DEFAULT_MODEL,
      contents: `判断下列问题是否缺少关键现实信息。不需要时返回空数组；需要时只返回 3–5 个短且必要的单选或多选问题，ID 依次为 custom_q1..custom_q5。\n${JSON.stringify(input)}`,
      config: config(dynamicQuestionsResponseSchema, options.signal),
    });
    const envelope = dynamicQuestionsEnvelope.parse(JSON.parse(result.text ?? ''));
    return parseDynamicQuestions(envelope.questions);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) throw new DeepAnalysisError('parse_failed');
    return mapError(error);
  }
}

export async function* generateDeepReportStream(
  input: DeepPromptInput,
  options: { signal?: AbortSignal; onStage?: (stage: string) => void } = {},
): AsyncGenerator<string, DeepReport | undefined> {
  try {
    if (input.directionId === 'work') options.onStage?.('researching');
    const research = input.directionId === 'work' ? await researchWorkJobs(input.answers, options) : undefined;
    options.signal?.throwIfAborted();
    options.onStage?.('analyzing');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL ?? DEFAULT_MODEL,
      contents: createDeepPrompt(input, research),
      config: config(research ? workReportResponseSchema : deepReportResponseSchema, options.signal),
    });
    let text = '';
    for await (const chunk of stream) {
      if (chunk.text) {
        text += chunk.text;
        yield chunk.text;
      }
    }
    if (!text) throw new DeepAnalysisError('upstream_failed');
    const modelReport = JSON.parse(text);
    const report = DeepReportSchema.omit({ jobResearch: true }).parse(modelReport);
    return research ? { ...report, jobResearch: buildJobResearch(research, modelReport.jobRecommendations) } : report;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) throw new DeepAnalysisError('parse_failed');
    return mapError(error);
  }
}
