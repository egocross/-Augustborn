'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Report } from '@/lib/gemini/schema';
import { getFixedQuestions, QUESTIONNAIRE_VERSION } from '@/lib/deep-analysis/questions';
import { createFreeReportSummary } from '@/lib/deep-analysis/summaries';
import { consumeDeepReportStream, DeepStreamError } from '@/lib/deep-analysis/stream';
import { createInitialDeepState, deepFlowReducer, loadDeepSession, saveDeepSession } from '@/lib/deep-analysis/session';
import type { AnswerValue, FixedDirectionId } from '@/lib/deep-analysis/types';
import { DirectionPicker } from './direction-picker';
import { DeepGeneratingModal } from './deep-generating-modal';
import { QuestionStep } from './question-step';

type BirthInput = { birthDate: string; birthTime: string | null; birthRegion: string };

const paymentTitles = {
  work: '你的职业方向深度分析已经准备好',
  industry: '你的行业方向深度分析已经准备好',
  city: '你的城市发展深度分析已经准备好',
  collaboration: '你的工作环境与合作关系深度分析已经准备好',
  custom: '你的专项问题深度分析已经准备好',
} as const;

type PaymentMode = 'mock' | 'alipay_sandbox';

type FlowError = { title: string; detail: string };

/**
 * Turns an internal failure code into something the reader can act on: what
 * happened, whether the answers survived, and whether they must pay again.
 */
export function describeFlowError(code: string | null, paid: boolean): FlowError | null {
  if (!code) return null;

  switch (code) {
    case 'payment_failed':
      return { title: '支付没有完成', detail: '你的答案已保留，可以重新尝试生成。' };
    case 'payment_invalid':
      return { title: '支付凭证已失效', detail: '请重新发起支付，之前的答题内容仍然保留。' };
    case 'payment_pending':
    case 'payment_status_unavailable':
      return {
        title: '还没有确认到支付结果',
        detail: paid ? '你的答案已保留。稍等片刻后重试即可，不会重复扣款。' : '如果已经完成付款，稍等片刻后重试即可。',
      };
    case 'timeout':
      return { title: '生成时间过长，已经中止', detail: '你的答案已保留，可以直接重新生成。' };
    case 'parse_failed':
      return { title: '报告内容整理失败', detail: '你的答案已保留，重新生成即可，不需要再次付款。' };
    case 'upstream_failed':
      return {
        title: '报告生成没有完成',
        detail: paid ? '答题与支付状态都已保留，直接重试即可，不需要再次付款。' : '你的答案已保留，可以重新尝试。',
      };
    case 'cancelled':
      return { title: '已取消生成', detail: '你的答案已保留，可以随时重新生成。' };
    case 'interrupted':
      return { title: '上次生成被中断', detail: '你的答案已保留，可以直接重新生成。' };
    default:
      return { title: '上次操作未完成', detail: '你的答案已保留，可以重试。' };
  }
}

export function DeepAnalysisFlow({
  birthInput,
  freeReport,
  price,
  paymentMode = 'mock',
  returnedOrderId = null,
  redirectToCheckout = (url) => window.location.assign(url),
}: {
  birthInput: BirthInput;
  freeReport: Report;
  price: string;
  paymentMode?: PaymentMode;
  returnedOrderId?: string | null;
  redirectToCheckout?: (url: string) => void;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    deepFlowReducer,
    createInitialDeepState('pending-session', { birthInput, freeReport }),
  );
  const [hydrated, setHydrated] = useState(false);
  const [generationStage, setGenerationStage] = useState('preparing');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const autoGenerationOrderRef = useRef<string | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadDeepSession(window.sessionStorage);
      const fallbackId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `session-${Date.now()}`;
      const base = restored?.birthInput && restored.freeReport
        ? restored
        : createInitialDeepState(fallbackId, { birthInput, freeReport });
      // The Alipay return leg carries the order id, so a pending payment still
      // resumes when the local session did not record it before the redirect.
      const resumed = paymentMode === 'alipay_sandbox' && returnedOrderId && base.step === 'payment' && !base.paymentOrderId
        ? { ...base, paymentOrderId: returnedOrderId }
        : base;
      dispatch({ type: 'restore', state: resumed });
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [birthInput, freeReport, paymentMode, returnedOrderId]);

  useEffect(() => {
    if (hydrated) saveDeepSession(state, window.sessionStorage);
  }, [hydrated, state]);

  useEffect(() => () => generationControllerRef.current?.abort(), []);

  const questions = useMemo(() => state.selectedDirection === 'custom'
    ? state.customQuestions
    : state.selectedDirection ? getFixedQuestions(state.selectedDirection as FixedDirectionId) : [], [state.selectedDirection, state.customQuestions]);
  const question = questions[state.questionIndex];
  const currentAnswer = question ? state.answers[question.id] ?? {} : {};
  const supplementaryField = question && 'supplementaryField' in question ? question.supplementaryField : undefined;
  const supplementaryRequired = Boolean(
    supplementaryField?.required
    && (!supplementaryField.showWhenOptionId || currentAnswer.optionIds?.includes(supplementaryField.showWhenOptionId)),
  );
  const supplementaryVisible = Boolean(
    supplementaryField
    && (!supplementaryField.showWhenOptionId || currentAnswer.optionIds?.includes(supplementaryField.showWhenOptionId)),
  );
  const answerReady = question?.type === 'text'
    ? Boolean(currentAnswer.textValue?.trim())
    : Boolean(currentAnswer.optionIds?.length)
      && (!supplementaryRequired || Boolean(currentAnswer.supplementaryValue?.some((value) => value.trim())));
  const needsManualContinue = question?.type !== 'single' || supplementaryVisible;
  const flowError = describeFlowError(state.errorCode, Boolean(state.paymentReceipt));

  async function prepareCustomQuestions() {
    if (state.customQuestion.trim().length < 2) return;
    dispatch({ type: 'customLoading' });
    try {
      const response = await fetch('/api/deep-analysis/custom-questions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: state.sessionId, customQuestion: state.customQuestion, freeReportSummary: createFreeReportSummary(freeReport) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.code || 'upstream_failed');
      dispatch({ type: 'customQuestionsReady', questions: payload.questions });
    } catch (error) { dispatch({ type: 'customQuestionsFailed', code: error instanceof Error ? error.message : 'upstream_failed' }); }
  }

  async function generateReport(receiptOverride?: string) {
    const receipt = receiptOverride ?? state.paymentReceipt;
    if (!receipt) {
      dispatch({ type: 'generationFailed', code: 'payment_failed' });
      return;
    }

    const controller = new AbortController();
    generationControllerRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 255_000);

    setGenerationStage('preparing');
    dispatch({ type: 'generationStarted', receipt });

    try {
      const response = await fetch('/api/deep-analysis/report', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ sessionId: state.sessionId, paymentReceipt: receipt, birthInput, freeReport, selectedDirection: state.selectedDirection, questionnaireVersion: QUESTIONNAIRE_VERSION, answers: state.answers, optionalContext: state.optionalContext, customQuestion: state.selectedDirection === 'custom' ? state.customQuestion : null, customQuestions: state.customQuestions }) });
      if (!response.ok || !response.body) { const payload = await response.json().catch(() => ({})); throw new Error(payload.code || 'upstream_failed'); }
      const report = await consumeDeepReportStream(response.body, { onStatus: setGenerationStage });
      const completedState = {
        ...state,
        paymentReceipt: receipt,
        report,
        lastReport: report,
        step: 'report' as const,
        errorCode: null,
      };
      saveDeepSession(completedState, window.sessionStorage);
      dispatch({ type: 'restore', state: completedState });
      router.push('/deep-report');
    } catch (error) {
      const code = timedOut
        ? 'timeout'
        : controller.signal.aborted
          ? 'cancelled'
          : error instanceof DeepStreamError
            ? error.code
            : error instanceof Error
              ? error.message
              : 'upstream_failed';
      dispatch({ type: 'generationFailed', code });
    } finally {
      clearTimeout(timer);
      if (generationControllerRef.current === controller) generationControllerRef.current = null;
    }
  }

  function cancelGeneration() {
    generationControllerRef.current?.abort();
  }

  async function startPayment() {
    if (!state.selectedDirection || paymentBusy) return;
    setPaymentBusy(true);
    try {
      if (state.paymentReceipt) {
        await generateReport(state.paymentReceipt);
        return;
      }
      const payment = await fetch('/api/deep-analysis/payment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, directionId: state.selectedDirection }),
      });
      const paymentData = await payment.json();
      if (!payment.ok) throw new Error(paymentData.code || 'payment_failed');
      if (paymentData.status === 'paid' && typeof paymentData.receipt === 'string') {
        await generateReport(paymentData.receipt);
        return;
      }
      if (
        paymentData.status === 'pending'
        && typeof paymentData.orderId === 'string'
        && typeof paymentData.checkoutUrl === 'string'
      ) {
        const action = { type: 'paymentStarted' as const, orderId: paymentData.orderId };
        const pendingState = deepFlowReducer(state, action);
        saveDeepSession(pendingState, window.sessionStorage);
        dispatch(action);
        redirectToCheckout(paymentData.checkoutUrl);
        return;
      }
      throw new Error('payment_failed');
    } catch (error) {
      dispatch({ type: 'generationFailed', code: error instanceof Error ? error.message : 'payment_failed' });
    } finally {
      setPaymentBusy(false);
    }
  }

  useEffect(() => {
    if (
      !hydrated
      || paymentMode !== 'alipay_sandbox'
      || state.step !== 'payment'
      || !state.paymentOrderId
      || state.paymentReceipt
      || autoGenerationOrderRef.current === state.paymentOrderId
    ) return;

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    const poll = async () => {
      try {
        const response = await fetch('/api/deep-analysis/payment/status', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId: state.paymentOrderId, sessionId: state.sessionId }),
        });
        const payload = await response.json();
        if (cancelled) return;
        if (response.ok && payload.status === 'paid' && typeof payload.receipt === 'string') {
          autoGenerationOrderRef.current = state.paymentOrderId;
          dispatch({ type: 'paymentConfirmed', receipt: payload.receipt });
          await generateReport(payload.receipt);
          return;
        }
        attempts += 1;
        if (response.ok && payload.status === 'pending' && attempts < 120) {
          timer = window.setTimeout(poll, 1_500);
          return;
        }
        dispatch({ type: 'generationFailed', code: payload.code || 'payment_pending' });
      } catch {
        if (!cancelled) dispatch({ type: 'generationFailed', code: 'payment_status_unavailable' });
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // The payment order identity deliberately owns this polling lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, paymentMode, state.paymentOrderId, state.paymentReceipt, state.sessionId, state.step]);

  if (!hydrated) return <section aria-busy="true" className="deep-panel" />;
  if (state.step === 'direction') return <DirectionPicker onSelect={(directionId) => dispatch({ type: 'chooseDirection', directionId })} />;
  if (state.step === 'custom-question' || state.step === 'custom-loading') return <section className="deep-panel question-panel">
    <p className="step-label">自定义问题</p><h2>你最想弄清什么？</h2>
    <p className="deep-lead">用一两句话写下你现在最想弄清楚的问题，我们会据此判断是否需要补充几道小问题。</p>
    <textarea aria-label="我的问题" disabled={state.step === 'custom-loading'} maxLength={1000} onChange={(event) => dispatch({ type: 'setCustomQuestion', value: event.target.value })} rows={5} value={state.customQuestion} />{state.errorCode && state.step !== 'custom-loading' ? <p className="form-error" role="alert">补充问题暂时无法生成，你的输入已保留，请重试。</p> : null}
    <div className="deep-actions"><button className="secondary-button" onClick={() => dispatch({ type: 'backToDirection' })} type="button">返回</button><button className="primary-button" disabled={state.step === 'custom-loading' || state.customQuestion.trim().length < 2} onClick={prepareCustomQuestions} type="button">{state.step === 'custom-loading' ? '正在判断是否需要补充…' : '继续'}</button></div>
  </section>;
  if (state.step === 'questions' && question) return <section className="deep-panel question-panel question-viewport">
    <p className="step-label">第 {state.questionIndex + 1} / {questions.length} 题</p>
    <div className="question-scroll-area" key={question.id}>
    <QuestionStep
      answer={currentAnswer}
      onChange={(answer: AnswerValue) => dispatch({ type: 'setAnswer', questionId: question.id, answer })}
      onSingleSelect={() => dispatch({ type: 'nextQuestion', total: questions.length })}
      question={question}
    />
    </div>
    <div className="deep-actions">
      <button className="secondary-button" onClick={() => dispatch({ type: 'previousQuestion' })} type="button">上一步</button>
      {needsManualContinue ? <button className="primary-button" disabled={!answerReady} onClick={() => dispatch({ type: 'nextQuestion', total: questions.length })} type="button">继续</button> : null}
    </div>
  </section>;
  if (state.step === 'optional-context') return <section className="deep-panel question-panel">
    <p className="step-label">最后一步</p><h2>还有什么现实情况希望我们考虑？</h2>
    <p className="deep-lead">例如收入压力、家庭情况、学历限制或已考虑的选项。这一步不是必填。</p>
    <textarea aria-label="补充情况" maxLength={2000} onChange={(event) => dispatch({ type: 'setOptionalContext', value: event.target.value })} rows={6} value={state.optionalContext} />
    <div className="deep-actions"><button className="secondary-button" onClick={() => dispatch({ type: 'backToLastQuestion' })} type="button">上一步</button><button className="primary-button" onClick={() => dispatch({ type: 'goToPayment' })} type="button">查看深度报告说明</button></div>
  </section>;
  if (state.step === 'payment') return <section className="deep-panel payment-panel">
    <p className="eyebrow">专项深度分析</p>
    <h2>{state.selectedDirection ? paymentTitles[state.selectedDirection] : '你的深度分析已经准备好'}</h2>
    <p className="deep-lead">确认后会开始生成，系统会综合出生信息、基础报告、校准问题与补充信息，生成更具体的专项报告。</p>
    <p className="price-label">{price}</p>
    {flowError ? <div className="flow-error" role="alert"><strong>{flowError.title}</strong><span>{flowError.detail}</span></div> : null}
    {state.paymentReceipt ? <p className="mock-note">已完成支付，无需重复付款。</p> : null}
    <div className="deep-actions deep-actions-payment">
      <button className="secondary-button" onClick={() => dispatch({ type: 'backToOptionalContext' })} type="button">修改答案</button>
      <button className="primary-button" disabled={paymentBusy} onClick={startPayment} type="button">{paymentMode === 'alipay_sandbox' ? (paymentBusy ? '正在连接支付宝…' : '前往支付宝沙箱付款') : (paymentBusy ? '正在准备…' : '生成我的深度报告')}</button>
    </div>
    <p className="mock-note">{paymentMode === 'alipay_sandbox' ? '沙箱环境只使用测试账号与测试资金，不会从真实账户扣款。' : '当前为体验模式，本次不会实际扣款。'}</p>
  </section>;
  if (state.step === 'generating') return <DeepGeneratingModal onCancel={cancelGeneration} stage={generationStage} />;
  if (state.step === 'report' && state.report) return <section className="deep-panel deep-report-ready"><p className="eyebrow">专项报告已生成</p><h2>{state.report.title}</h2><p className="deep-lead">完整报告已放在独立阅读页面中，你可以随时返回继续查看。</p><button className="primary-button" onClick={() => router.push('/deep-report')} type="button">查看深度报告</button></section>;
  return null;
}
