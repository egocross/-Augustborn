import 'server-only';

import OpenAI from 'openai';

import type { BaziChart } from '@/lib/bazi/types';

import {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_REASONING_EFFORT,
  KIE_GEMINI_BASE_URL,
} from './config';
import { createReportPrompt } from './prompt';
import { ReportJsonSchema, parseReport, type Report } from './schema';

const DEFAULT_MODEL = 'gemini-3.1-pro-openai';

const describeEmptyCompletion = (completion: unknown): string => {
  if (typeof completion !== 'object' || completion === null) {
    return `response type: ${typeof completion}`;
  }

  const record = completion as Record<string, unknown>;
  const diagnostics: Record<string, unknown> = {};
  for (const key of ['error', 'message', 'msg', 'detail', 'code', 'type']) {
    if (key in record) {
      diagnostics[key] = record[key];
    }
  }

  return `keys: ${Object.keys(record).join(', ')}; diagnostics: ${JSON.stringify(diagnostics).slice(0, 300)}`;
};

/** Generates a report through Kie's OpenAI-compatible Gemini endpoint. */
export const generateReportWithKie = async (chart: BaziChart): Promise<Report> => {
  const ai = new OpenAI({
    apiKey: GEMINI_API_KEY,
    baseURL: KIE_GEMINI_BASE_URL,
  });
  const createCompletion = () =>
    ai.chat.completions.create({
      model: GEMINI_MODEL ?? DEFAULT_MODEL,
      messages: [{ role: 'user', content: createReportPrompt(chart) }],
      reasoning_effort: GEMINI_REASONING_EFFORT,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'bazi_report',
          strict: true,
          schema: ReportJsonSchema,
        },
      },
    });

  let response = await createCompletion();
  let content = response.choices?.[0]?.message?.content ?? null;

  if (!content) {
    console.error('kie_empty_completion', describeEmptyCompletion(response));
    response = await createCompletion();
    content = response.choices?.[0]?.message?.content ?? null;
  }

  if (!content) {
    throw new Error(`Kie returned no report content (${describeEmptyCompletion(response)}).`);
  }

  return parseReport(JSON.parse(content));
};
