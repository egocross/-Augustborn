import { GoogleGenAI, ThinkingLevel } from '@google/genai';

import type { BaziChart } from '@/lib/bazi/types';

import { GEMINI_API_KEY, GEMINI_MODEL } from './config';
import { createReportPrompt } from './prompt';
import { ReportJsonSchema, parseReport, type Report } from './schema';

/** Generates a validated interpretive report without retaining chart data. */
export const generateReport = async (chart: BaziChart): Promise<Report> => {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: createReportPrompt(chart),
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: ReportJsonSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  });

  if (!response.text) {
    throw new Error('Gemini returned no report content.');
  }

  return parseReport(JSON.parse(response.text));
};
