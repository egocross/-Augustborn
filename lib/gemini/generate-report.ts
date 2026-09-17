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

/** Generates a validated interpretive report without retaining chart data. */
export const generateReport = async (chart: BaziChart): Promise<Report> => {
  const ai = new OpenAI({
    apiKey: GEMINI_API_KEY,
    baseURL: KIE_GEMINI_BASE_URL,
  });
  const response = await ai.chat.completions.create({
    model: GEMINI_MODEL,
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

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error('Kie returned no report content.');
  }

  return parseReport(JSON.parse(content));
};
