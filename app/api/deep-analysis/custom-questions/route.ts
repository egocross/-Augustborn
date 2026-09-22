import { z } from 'zod';

import { DeepAnalysisError } from '@/lib/deep-analysis/gemini';
import { createCustomQuestions } from '@/lib/report-provider';

const RequestSchema = z.object({
  sessionId: z.string().min(8).max(100),
  customQuestion: z.string().trim().min(2).max(1000),
  freeReportSummary: z.object({
    sections: z.array(z.object({
      heading: z.string().max(100), summary: z.string().max(600), bullets: z.array(z.string().max(240)).max(8),
    })).max(12),
  }),
}).strict();

const messages = {
  timeout: '分析等待时间过长，请重试。',
  upstream_failed: '分析服务暂时不可用，请重试。',
  parse_failed: '补充问题生成失败，请重试。',
} as const;

type Generator = typeof createCustomQuestions;

export const createCustomQuestionsHandler = (generator: Generator = createCustomQuestions) => async (request: Request) => {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ code: 'invalid_input', error: '请检查输入内容。' }, { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const questions = await generator(parsed.data, { signal: controller.signal });
    return Response.json({ questions });
  } catch (error) {
    const candidate = error instanceof DeepAnalysisError || (
      typeof error === 'object' && error !== null && 'code' in error
    ) ? (error as { code?: string }).code : undefined;
    const code = candidate === 'timeout' || candidate === 'parse_failed' || candidate === 'upstream_failed'
      ? candidate
      : 'upstream_failed';
    return Response.json({ code, error: messages[code] }, { status: code === 'timeout' ? 504 : 502 });
  } finally {
    clearTimeout(timer);
  }
};

export const POST = createCustomQuestionsHandler();
