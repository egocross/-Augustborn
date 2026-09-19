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

const DEFAULT_MODEL = 'gemini-3.1-pro-preview';

const THINKING_LEVELS: Record<GeminiReasoningEffort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * Gemini accepts a subset of JSON Schema for structured output, so this stays
 * minimal; the route still validates the finished report before sending it on.
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

const emptyStreamError = 'Gemini returned no report content.';

/** Streams the report JSON text from the official Google Gemini API. */
export async function* generateReportStream(chart: BaziChart): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const model = GEMINI_MODEL ?? DEFAULT_MODEL;
  const thinkingLevel = THINKING_LEVELS[GEMINI_REASONING_EFFORT];
  console.info('gemini_request', { model, thinkingLevel });

  const startedAt = Date.now();
  const stream = await ai.models.generateContentStream({
    model,
    contents: createReportPrompt(chart),
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: reportResponseSchema,
      thinkingConfig: { thinkingLevel },
    },
  });

  let usage: { promptTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number } | undefined;
  let outputChars = 0;
  let firstChunkMs: number | null = null;

  for await (const chunk of stream) {
    usage = chunk.usageMetadata ?? usage;
    const text = chunk.text;
    if (!text) {
      continue;
    }

    if (firstChunkMs === null) {
      firstChunkMs = Date.now() - startedAt;
      console.info('gemini_first_chunk', { ms: firstChunkMs });
    }

    outputChars += text.length;
    yield text;
  }

  console.info('gemini_stream_done', {
    elapsedMs: Date.now() - startedAt,
    firstChunkMs,
    outputChars,
    promptTokens: usage?.promptTokenCount,
    thoughtsTokens: usage?.thoughtsTokenCount,
    totalTokens: usage?.totalTokenCount,
  });

  if (outputChars === 0) {
    throw new Error(emptyStreamError);
  }
}
