import 'server-only';

import type { BaziChart } from '@/lib/bazi/types';
import {
  DeepAnalysisError,
  generateCareerReportStream,
} from '@/lib/deep-analysis/gemini';
import type { CareerGenerationRequest } from '@/lib/deep-analysis/career-pipeline';
import type { DeepReport } from '@/lib/deep-analysis/types';
import { generateReportStream } from '@/lib/gemini/generate-report';
import { getReportProvider } from './config';
import { streamSampleBaseReport, streamSampleDeepReport } from './sample';

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
  input: CareerGenerationRequest,
  options: { signal?: AbortSignal; onStage?: (stage: string) => void } = {},
): AsyncGenerator<string, DeepReport | undefined> {
  if (getReportProvider() === 'sample') {
    return yield* streamSampleDeepReport(input);
  }
  return yield* generateCareerReportStream(input, options);
}
