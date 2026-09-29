import { z } from 'zod';

import { verifyBaseReportSnapshot } from '@/lib/deep-analysis/base-report-snapshot';
import { CareerCalibrationSchema, type CareerCalibration } from '@/lib/deep-analysis/career-calibration';
import { CAREER_QUESTIONNAIRE_VERSION } from '@/lib/deep-analysis/career-calibration-questions';
import { DeepAnalysisError } from '@/lib/deep-analysis/gemini';
import { verifyPaymentReceipt } from '@/lib/deep-analysis/payment';
import { persistDeepSession } from '@/lib/deep-analysis/persistence';
import { CAREER_DIRECTION_ID, DeepReportSchema, type DeepReport } from '@/lib/deep-analysis/types';
import { ReportSchema, type Report } from '@/lib/gemini/schema';
import { streamDeepReport } from '@/lib/report-provider';

export const maxDuration = 300;

const RequestSchema = z.object({
  sessionId: z.string().min(8).max(100),
  paymentReceipt: z.string().min(10).max(5000),
  questionnaireVersion: z.literal(CAREER_QUESTIONNAIRE_VERSION),
  baseReport: ReportSchema,
  baseReportSnapshotToken: z.string().min(10).max(5000),
  careerCalibration: CareerCalibrationSchema,
}).strict();

type CareerGenerationInput = {
  baseReport: Report;
  careerCalibration: CareerCalibration;
  questionnaireVersion: typeof CAREER_QUESTIONNAIRE_VERSION;
};

type CareerPersistEvent = {
  id: string;
  selectedDirection: typeof CAREER_DIRECTION_ID;
  questionnaireVersion: typeof CAREER_QUESTIONNAIRE_VERSION;
  careerCalibration: CareerCalibration;
  paymentStatus: 'paid';
  reportStatus: 'generating' | 'complete' | 'failed';
  reportResult: DeepReport | null;
};

type GenerateOptions = {
  signal: AbortSignal;
  onStage: (stage: string) => void;
};

type Dependencies = {
  generate: (
    input: CareerGenerationInput,
    options: GenerateOptions,
  ) => AsyncGenerator<string, DeepReport | void, void>;
  persist: (event: CareerPersistEvent) => Promise<{ persisted: boolean }>;
  verifyReceipt: typeof verifyPaymentReceipt;
  verifySnapshot: typeof verifyBaseReportSnapshot;
};

const defaults: Dependencies = {
  generate: streamDeepReport,
  persist: persistDeepSession,
  verifyReceipt: verifyPaymentReceipt,
  verifySnapshot: verifyBaseReportSnapshot,
};

export const createDeepReportHandler = (dependencies: Dependencies = defaults) => async (request: Request) => {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ code: 'invalid_input', error: '请检查提交内容。' }, { status: 400 });
  }
  const input = parsed.data;
  if (!dependencies.verifySnapshot(input.baseReport, input.baseReportSnapshotToken)) {
    return Response.json({ code: 'invalid_base_report', error: '基础报告校验失败，请重新生成。' }, { status: 400 });
  }
  const verified = dependencies.verifyReceipt(input.paymentReceipt, {
    sessionId: input.sessionId,
    directionId: CAREER_DIRECTION_ID,
  });
  if (!verified.success) {
    return Response.json({ code: 'payment_invalid', error: '支付凭证无效或已过期。' }, { status: 402 });
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
      const safePersist = async (event: CareerPersistEvent) => {
        try { await dependencies.persist(event); } catch { /* Optional persistence never blocks delivery. */ }
      };
      const deadline = setTimeout(() => abortController.abort(), 240_000);
      const heartbeat = setInterval(() => send({ type: 'heartbeat' }), 15_000);
      const baseEvent = {
        id: input.sessionId,
        selectedDirection: CAREER_DIRECTION_ID,
        questionnaireVersion: CAREER_QUESTIONNAIRE_VERSION,
        careerCalibration: input.careerCalibration,
        paymentStatus: 'paid' as const,
      };
      try {
        send({ type: 'status', stage: 'preparing' });
        await safePersist({ ...baseEvent, reportStatus: 'generating', reportResult: null });
        send({ type: 'status', stage: 'constraints' });
        send({ type: 'status', stage: 'capital' });
        const iterator = dependencies.generate({
          baseReport: input.baseReport,
          careerCalibration: input.careerCalibration,
          questionnaireVersion: CAREER_QUESTIONNAIRE_VERSION,
        }, {
          signal: abortController.signal,
          onStage: (stage) => send({ type: 'status', stage }),
        });
        let text = '';
        let verifiedReport: DeepReport | void;
        while (true) {
          const next = await iterator.next();
          if (next.done) { verifiedReport = next.value; break; }
          text += next.value;
        }
        send({ type: 'status', stage: 'validating' });
        const report = DeepReportSchema.parse(verifiedReport ?? JSON.parse(text));
        await safePersist({ ...baseEvent, reportStatus: 'complete', reportResult: report });
        send({ type: 'report', report });
      } catch (error) {
        const code = error instanceof DeepAnalysisError ? error.code
          : error instanceof z.ZodError || error instanceof SyntaxError ? 'parse_failed'
            : 'upstream_failed';
        await safePersist({ ...baseEvent, reportStatus: 'failed', reportResult: null });
        send({ type: 'error', code, message: code === 'timeout' ? '生成超时，请重试。' : '深度报告生成失败，请重试。' });
      } finally {
        clearTimeout(deadline);
        clearInterval(heartbeat);
        request.signal.removeEventListener('abort', onRequestAbort);
        try { controller.close(); } catch { /* Client may have cancelled the stream. */ }
      }
    },
  });
  return new Response(stream, {
    headers: { 'cache-control': 'no-cache, no-transform', 'content-type': 'text/event-stream; charset=utf-8' },
  });
};

export const POST = createDeepReportHandler();
