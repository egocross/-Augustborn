import 'server-only';

import type { BaziChart } from '@/lib/bazi/types';
import {
  DeepAnalysisError,
  generateCustomQuestions,
  generateDeepReportStream,
} from '@/lib/deep-analysis/gemini';
import type { DeepPromptInput } from '@/lib/deep-analysis/prompts';
import type { DeepReport, DynamicQuestion } from '@/lib/deep-analysis/types';
import { generateReportStream } from '@/lib/gemini/generate-report';
import { getReportProvider } from './config';
import { createSampleCustomQuestions, streamSampleBaseReport, streamSampleDeepReport } from './sample';

export { DeepAnalysisError };

/**
 * Single seam for every model call in the product. Routes import from here so
 * `REPORT_PROVIDER=sample` can replace Gemini with local content without
 * touching request handling, streaming or validation.
 */
export async function* streamBaseReport(chart: BaziChart): AsyncGenerator<string> {
  if (getReportProvider() === 'sample') {
    yield* streamSampleBaseReport(chart);
    return;
  }
  yield* generateReportStream(chart);
}

export async function* streamDeepReport(
  input: DeepPromptInput,
  options: { signal?: AbortSignal; onStage?: (stage: string) => void } = {},
): AsyncGenerator<string, DeepReport | undefined> {
  if (getReportProvider() === 'sample') {
    return yield* streamSampleDeepReport(input);
  }
  return yield* generateDeepReportStream(input, options);
}

export async function createCustomQuestions(
  input: { customQuestion: string; freeReportSummary: { sections: unknown[] } },
  options: { signal?: AbortSignal } = {},
): Promise<DynamicQuestion[]> {
  if (getReportProvider() === 'sample') {
    return createSampleCustomQuestions(input);
  }
  return generateCustomQuestions(input, options);
}
