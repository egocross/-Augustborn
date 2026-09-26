import { z } from 'zod';

import { createChart } from '@/lib/bazi/chart';
import { validateDirectionAnswers } from '@/lib/deep-analysis/answers';
import { DeepAnalysisError } from '@/lib/deep-analysis/gemini';
import { verifyPaymentReceipt } from '@/lib/deep-analysis/payment';
import { persistDeepSession } from '@/lib/deep-analysis/persistence';
import { streamDeepReport } from '@/lib/report-provider';
import { createBirthSummary, createFreeReportSummary } from '@/lib/deep-analysis/summaries';
import { DeepAnswersSchema, DeepReportSchema, DirectionIdSchema, DynamicQuestionSchema, QuestionnaireVersionSchema } from '@/lib/deep-analysis/types';
import { ReportSchema } from '@/lib/gemini/schema';
import { analysisSchema } from '@/lib/validation';

export const maxDuration = 300;

const RequestSchema = z.object({
  sessionId: z.string().min(8).max(100), paymentReceipt: z.string().min(10).max(5000),
  birthInput: analysisSchema, freeReport: ReportSchema, selectedDirection: DirectionIdSchema,
  questionnaireVersion: QuestionnaireVersionSchema, answers: DeepAnswersSchema,
  optionalContext: z.string().max(2000), customQuestion: z.string().max(1000).nullable(),
  customQuestions: z.array(DynamicQuestionSchema).max(5),
}).strict();

type Dependencies = {
  generate: typeof streamDeepReport;
  persist: typeof persistDeepSession;
  verifyReceipt: typeof verifyPaymentReceipt;
};

const defaults: Dependencies = { generate: streamDeepReport, persist: persistDeepSession, verifyReceipt: verifyPaymentReceipt };

const validateCustomAnswers = (questions: z.infer<typeof DynamicQuestionSchema>[], answers: Record<string, { optionIds?: string[] }>) => {
  if (questions.length !== 0 && (questions.length < 3 || questions.length > 5)) return false;
  if (Object.keys(answers).some((id) => !questions.some((question) => question.id === id))) return false;
  return questions.every((question) => {
    const selected = [...new Set(answers[question.id]?.optionIds ?? [])];
    const withinLimit = question.type === 'single'
      ? selected.length === 1
      : !question.maxSelect || selected.length <= question.maxSelect;
    return selected.length > 0 && withinLimit
      && selected.every((id) => question.options.some((option) => option.id === id));
  });
};

export const createDeepReportHandler = (dependencies: Dependencies = defaults) => async (request: Request) => {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ code: 'invalid_input', error: '请检查提交内容。' }, { status: 400 });
  const input = parsed.data;
  const verified = dependencies.verifyReceipt(input.paymentReceipt, { sessionId: input.sessionId, directionId: input.selectedDirection });
  if (!verified.success) return Response.json({ code: 'payment_invalid', error: '支付凭证无效或已过期。' }, { status: 402 });

  const answerResult = input.selectedDirection === 'custom'
    ? { success: validateCustomAnswers(input.customQuestions, input.answers) }
    : validateDirectionAnswers(input.selectedDirection, input.answers, input.questionnaireVersion);
  if (!answerResult.success || (input.selectedDirection === 'custom' && !input.customQuestion?.trim())) {
    return Response.json({ code: 'invalid_input', error: '问卷答案不完整。' }, { status: 400 });
  }

  let chart;
  try { chart = createChart(input.birthInput); } catch {
    return Response.json({ code: 'invalid_input', error: '出生信息无法计算。' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const abortController = new AbortController();
      const onRequestAbort = () => abortController.abort();
      request.signal.addEventListener('abort', onRequestAbort, { once: true });
      if (request.signal.aborted) onRequestAbort();
      const send = (event: unknown) => {
        if (request.signal.aborted) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); }
        catch { abortController.abort(); }
      };
      const safePersist = async (event: Parameters<typeof dependencies.persist>[0]) => {
        try { await dependencies.persist(event); } catch { /* Optional persistence never blocks delivery. */ }
      };
      const deadline = setTimeout(() => abortController.abort(), 240_000);
      const heartbeat = setInterval(() => send({ type: 'heartbeat' }), 15_000);
      const baseEvent = {
        id: input.sessionId, selectedDirection: input.selectedDirection, questionnaireVersion: input.questionnaireVersion,
        answers: input.answers, optionalContext: input.optionalContext, customQuestion: input.customQuestion,
        paymentStatus: 'paid' as const,
      };
      try {
        send({ type: 'status', stage: 'preparing' });
        await safePersist({ ...baseEvent, reportStatus: 'generating', reportResult: null });
        send({ type: 'status', stage: 'analyzing' });
        const iterator = dependencies.generate({
          birthProfile: createBirthSummary(input.birthInput, chart),
          freeReportSummary: createFreeReportSummary(input.freeReport), directionId: input.selectedDirection,
          questionnaireVersion: input.questionnaireVersion, answers: input.answers,
          optionalContext: input.optionalContext, customQuestion: input.customQuestion, cityContext: null,
        }, { signal: abortController.signal, onStage: (stage) => send({ type: 'status', stage }) });
        let text = '';
        let verifiedReport;
        let receivedFirstChunk = false;
        while (true) {
          const next = await iterator.next();
          if (next.done) { verifiedReport = next.value; break; }
          if (!receivedFirstChunk) {
            receivedFirstChunk = true;
            send({ type: 'status', stage: 'structuring' });
          }
          text += next.value;
        }
        send({ type: 'status', stage: 'validating' });
        // The adapter's final value contains server-validated sources; raw model chunks do not.
        const report = DeepReportSchema.parse(verifiedReport ?? JSON.parse(text));
        await safePersist({ ...baseEvent, reportStatus: 'complete', reportResult: report });
        send({ type: 'report', report });
      } catch (error) {
        const code = error instanceof DeepAnalysisError ? error.code : error instanceof z.ZodError || error instanceof SyntaxError ? 'parse_failed' : 'upstream_failed';
        await safePersist({ ...baseEvent, reportStatus: 'failed', reportResult: null });
        send({ type: 'error', code, message: code === 'timeout' ? '生成超时，请重试。' : '深度报告生成失败，请重试。' });
      } finally {
        clearTimeout(deadline); clearInterval(heartbeat);
        request.signal.removeEventListener('abort', onRequestAbort);
        try { controller.close(); } catch { /* Client may have cancelled the stream. */ }
      }
    },
  });
  return new Response(stream, { headers: { 'cache-control': 'no-cache, no-transform', 'content-type': 'text/event-stream; charset=utf-8' } });
};

export const POST = createDeepReportHandler();
