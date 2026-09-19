import 'server-only';

import { GoogleGenAI, ThinkingLevel } from '@google/genai';

import type { BaziChart } from '@/lib/bazi/types';

import {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_REASONING_EFFORT,
  type GeminiReasoningEffort,
} from './config';
import { createReportPrompt } from './prompt';
import { parseReport, type Report } from './schema';

const DEFAULT_MODEL = 'gemini-3.1-pro-preview';

const THINKING_LEVELS: Record<GeminiReasoningEffort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * Gemini accepts a subset of JSON Schema for structured output, so this stays
 * minimal; parseReport still enforces the full report shape afterwards.
 */
const reportResponseSchema = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          body: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
        },
        required: ['heading', 'body', 'bullets'],
      },
    },
    disclaimer: { type: 'string' },
  },
  required: ['sections', 'disclaimer'],
} as const;

const describeEmptyResponse = (response: {
  candidates?: Array<{ finishReason?: unknown }>;
  promptFeedback?: { blockReason?: unknown };
}): string =>
  `finishReason: ${String(response.candidates?.[0]?.finishReason ?? 'none')}, blockReason: ${String(
    response.promptFeedback?.blockReason ?? 'none',
  )}`;

/** Generates a validated report through the official Google Gemini API. */
export const generateReport = async (chart: BaziChart): Promise<Report> => {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const model = GEMINI_MODEL ?? DEFAULT_MODEL;
  const thinkingLevel = THINKING_LEVELS[GEMINI_REASONING_EFFORT];
  console.info('gemini_request', { model, thinkingLevel });

  const createResponse = () =>
    ai.models.generateContent({
      model,
      contents: createReportPrompt(chart),
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: reportResponseSchema,
        thinkingConfig: { thinkingLevel },
      },
    });

  const startedAt = Date.now();
  let response = await createResponse();
  let content = response.text ?? null;

  if (!content) {
    console.error('gemini_empty_response', describeEmptyResponse(response));
    response = await createResponse();
    content = response.text ?? null;
  }

  if (!content) {
    throw new Error(`Gemini returned no report content (${describeEmptyResponse(response)}).`);
  }

  const usage = response.usageMetadata;
  console.info('gemini_report_ready', {
    model,
    thinkingLevel,
    elapsedMs: Date.now() - startedAt,
    outputChars: content.length,
    promptTokens: usage?.promptTokenCount,
    thoughtsTokens: usage?.thoughtsTokenCount,
    totalTokens: usage?.totalTokenCount,
  });

  return parseReport(JSON.parse(content));
};
