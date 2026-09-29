'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Report } from '@/lib/gemini/schema';
import {
  normalizeCareerCalibration,
  validateCareerDraft,
  type CareerDraftAnswer,
} from '@/lib/deep-analysis/career-calibration';
import {
  CAREER_QUESTIONNAIRE_VERSION,
  CAREER_QUESTIONS,
  CAREER_SECTIONS,
  getVisibleCareerQuestions,
  type CareerQuestion,
} from '@/lib/deep-analysis/career-calibration-questions';
import { consumeDeepReportStream, DeepStreamError } from '@/lib/deep-analysis/stream';
import {
  createInitialCareerState,
  deepFlowReducer,
  loadDeepSession,
  saveDeepSession,
} from '@/lib/deep-analysis/session';
import { CareerCalibrationQuestion } from './career-calibration-question';
import { CareerCalibrationSummary } from './career-calibration-summary';
import { DeepGeneratingModal } from './deep-generating-modal';

type PaymentMode = 'mock' | 'alipay_sandbox';
type FlowError = { title: string; detail: string };

export function describeFlowError(code: string | null, paid: boolean): FlowError | null {
  if (!code) return null;
  switch (code) {
    case 'payment_failed': return { title: '支付没有完成', detail: '你的答案已保留，可以重新尝试生成。' };
    case 'payment_invalid': return { title: '支付凭证已失效', detail: '请重新发起支付，之前的答题内容仍然保留。' };
    case 'payment_pending':
    case 'payment_status_unavailable': return {
      title: '还没有确认到支付结果',
      detail: paid ? '你的答案已保留。稍等片刻后重试即可，不会重复扣款。' : '如果已经完成付款，稍等片刻后重试即可。',
    };
    case 'timeout': return { title: '生成时间过长，已经中止', detail: '你的答案已保留，可以直接重新生成。' };
    case 'parse_failed': return { title: '报告内容整理失败', detail: '你的答案已保留，重新生成即可，不需要再次付款。' };
    case 'upstream_failed': return {
      title: '报告生成没有完成',
      detail: paid ? '答题与支付状态都已保留，直接重试即可，不需要再次付款。' : '你的答案已保留，可以重新尝试。',
    };
    case 'cancelled': return { title: '已取消生成', detail: '你的答案已保留，可以随时重新生成。' };
    case 'interrupted': return { title: '上次生成被中断', detail: '你的答案已保留，可以直接重新生成。' };
    default: return { title: '上次操作未完成', detail: '你的答案已保留，可以重试。' };
  }
}

const answerReady = (question: CareerQuestion, answer: CareerDraftAnswer): boolean => {
  if (!answer.optionIds.length) return false;
  if (question.type === 'single' && answer.optionIds.length !== 1) return false;
  if (question.maxSelections && answer.optionIds.length > question.maxSelections) return false;
  if (!question.other || !answer.optionIds.includes(question.other.optionId)) return true;
  if (question.other.inputType === 'currency') {
    return Number.isInteger(answer.numericValue) && (answer.numericValue ?? -1) >= 0;
  }
  return !question.other.required || Boolean(answer.textValue?.trim());
};

const locateQuestion = (questionId: string, answers: Record<string, CareerDraftAnswer>) => {
  const visibleIds = new Set(getVisibleCareerQuestions(answers).map((question) => question.id));
  for (let sectionIndex = 0; sectionIndex < CAREER_SECTIONS.length; sectionIndex += 1) {
    const sectionQuestions = CAREER_QUESTIONS.filter((question) => (
      question.section === CAREER_SECTIONS[sectionIndex].id && visibleIds.has(question.id)
    ));
    const questionIndex = sectionQuestions.findIndex((question) => question.id === questionId);
    if (questionIndex >= 0) return { sectionIndex, questionIndex };
  }
  return { sectionIndex: 0, questionIndex: 0 };
};

export function DeepAnalysisFlow({
  baseReportSnapshotToken,
  freeReport,
  price,
  paymentMode = 'mock',
  returnedOrderId = null,
  redirectToCheckout = (url) => window.location.assign(url),
}: {
  baseReportSnapshotToken: string;
  freeReport: Report;
  price: string;
  paymentMode?: PaymentMode;
  returnedOrderId?: string | null;
  redirectToCheckout?: (url: string) => void;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    deepFlowReducer,
    createInitialCareerState('pending-session', { baseReportSnapshotToken, freeReport }),
  );
  const [hydrated, setHydrated] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [generationStage, setGenerationStage] = useState('preparing');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const autoGenerationOrderRef = useRef<string | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadDeepSession(window.sessionStorage);
      const fallbackId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `session-${Date.now()}`;
      const base = restored?.freeReport && restored.baseReportSnapshotToken
        ? restored
        : createInitialCareerState(fallbackId, { baseReportSnapshotToken, freeReport });
      const resumed = paymentMode === 'alipay_sandbox' && returnedOrderId
        && base.step === 'payment' && !base.paymentOrderId
        ? { ...base, paymentOrderId: returnedOrderId }
        : base;
      dispatch({ type: 'restore', state: resumed });
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [baseReportSnapshotToken, freeReport, paymentMode, returnedOrderId]);

  useEffect(() => {
    if (hydrated) saveDeepSession(state, window.sessionStorage);
  }, [hydrated, state]);
  useEffect(() => () => generationControllerRef.current?.abort(), []);

  const visibleQuestions = useMemo(() => getVisibleCareerQuestions(state.answers), [state.answers]);
  const section = CAREER_SECTIONS[state.sectionIndex];
  const sectionQuestions = useMemo(() => visibleQuestions.filter(
    (item) => item.section === section?.id,
  ), [section?.id, visibleQuestions]);
  const question = sectionQuestions[state.questionIndex];
  const currentAnswer = question ? state.answers[question.id] ?? { optionIds: [] } : { optionIds: [] };
  const flowError = describeFlowError(state.errorCode, Boolean(state.paymentReceipt));

  function changeAnswer(answer: CareerDraftAnswer) {
    if (!question) return;
    setQuestionError(null);
    const isOther = Boolean(question.other && answer.optionIds.includes(question.other.optionId));
    if (question.type === 'single' && !isOther) {
      dispatch({ type: 'setAnswerAndAdvance', questionId: question.id, answer });
    } else {
      dispatch({ type: 'setAnswer', questionId: question.id, answer });
    }
  }

  function continueQuestions() {
    if (!question || !answerReady(question, currentAnswer)) {
      setQuestionError(question?.other?.inputType === 'currency' ? '请输入有效金额' : '请先完成当前问题');
      return;
    }
    dispatch({ type: 'nextQuestion' });
  }

  function buildCalibration() {
    const validation = validateCareerDraft(state.answers);
    if (!validation.valid) return null;
    return normalizeCareerCalibration(state.answers);
  }

  function repairInvalidSummary() {
    const validation = validateCareerDraft(state.answers);
    if (validation.valid) return;
    const first = validation.errors[0];
    dispatch({ type: 'goToQuestion', ...locateQuestion(first.questionId, state.answers) });
    setQuestionError(first.message);
  }

  async function generateReport(receiptOverride?: string) {
    const receipt = receiptOverride ?? state.paymentReceipt;
    if (!receipt || !state.calibration) {
      dispatch({ type: 'generationFailed', code: receipt ? 'invalid_calibration' : 'payment_failed' });
      return;
    }
    const controller = new AbortController();
    generationControllerRef.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 255_000);
    setGenerationStage('preparing');
    dispatch({ type: 'generationStarted', receipt });

    try {
      const response = await fetch('/api/deep-analysis/report', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({
          sessionId: state.sessionId,
          paymentReceipt: receipt,
          questionnaireVersion: CAREER_QUESTIONNAIRE_VERSION,
          baseReport: state.freeReport ?? freeReport,
          baseReportSnapshotToken: state.baseReportSnapshotToken ?? baseReportSnapshotToken,
          careerCalibration: state.calibration,
        }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.code || 'upstream_failed');
      }
      const report = await consumeDeepReportStream(response.body, { onStatus: setGenerationStage });
      const completedState = { ...state, paymentReceipt: receipt, report, step: 'report' as const, errorCode: null };
      saveDeepSession(completedState, window.sessionStorage);
      dispatch({ type: 'restore', state: completedState });
      router.push('/deep-report');
    } catch (error) {
      const code = timedOut ? 'timeout' : controller.signal.aborted ? 'cancelled'
        : error instanceof DeepStreamError ? error.code
          : error instanceof Error ? error.message : 'upstream_failed';
      dispatch({ type: 'generationFailed', code });
    } finally {
      window.clearTimeout(timer);
      if (generationControllerRef.current === controller) generationControllerRef.current = null;
    }
  }

  async function startPayment() {
    if (!state.calibration || paymentBusy) return;
    setPaymentBusy(true);
    try {
      if (state.paymentReceipt) {
        await generateReport(state.paymentReceipt);
        return;
      }
      const payment = await fetch('/api/deep-analysis/payment', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
      const paymentData = await payment.json();
      if (!payment.ok) throw new Error(paymentData.code || 'payment_failed');
      if (paymentData.status === 'paid' && typeof paymentData.receipt === 'string') {
        await generateReport(paymentData.receipt);
        return;
      }
      if (paymentData.status === 'pending' && typeof paymentData.orderId === 'string'
        && typeof paymentData.checkoutUrl === 'string') {
        const action = { type: 'paymentStarted' as const, orderId: paymentData.orderId };
        saveDeepSession(deepFlowReducer(state, action), window.sessionStorage);
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
    if (!hydrated || paymentMode !== 'alipay_sandbox' || state.step !== 'payment'
      || !state.paymentOrderId || state.paymentReceipt
      || autoGenerationOrderRef.current === state.paymentOrderId) return;
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    const poll = async () => {
      try {
        const response = await fetch('/api/deep-analysis/payment/status', {
          method: 'POST', headers: { 'content-type': 'application/json' },
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
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
    // Payment-order identity owns this polling lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, paymentMode, state.paymentOrderId, state.paymentReceipt, state.sessionId, state.step]);

  if (!hydrated) return <section aria-busy="true" className="deep-panel" />;
  if (state.step === 'intro') return (
    <section className="deep-panel question-panel career-intro-panel">
      <p className="eyebrow">职业现实校准</p>
      <h1>把基础倾向放进现实条件里校准</h1>
      <p className="deep-lead">约 2–4 分钟。我们会按顺序确认现实约束、职业资本与当前优先级，再收敛值得验证的职业方向。</p>
      <button className="primary-button" onClick={() => dispatch({ type: 'beginQuestions' })} type="button">开始现实校准</button>
    </section>
  );
  if (state.step === 'questions' && question) return (
    <section className="deep-panel question-panel question-viewport">
      <div className="career-stage-progress" aria-label="校准进度">
        <p className="step-label">{section.title}</p>
        <p>{section.description}</p>
      </div>
      <div className="question-scroll-area" key={question.id}>
        <CareerCalibrationQuestion
          answer={currentAnswer}
          error={questionError}
          onChange={changeAnswer}
          question={question}
        />
      </div>
      <div className="deep-actions">
        <button className="secondary-button" onClick={() => {
          setQuestionError(null);
          dispatch({ type: 'previousQuestion' });
        }} type="button">上一步</button>
        {question.type !== 'single' || Boolean(question.other && currentAnswer.optionIds.includes(question.other.optionId))
          ? <button className="primary-button" disabled={!answerReady(question, currentAnswer)} onClick={continueQuestions} type="button">继续</button>
          : null}
      </div>
    </section>
  );
  if (state.step === 'summary') {
    const calibration = buildCalibration();
    if (!calibration) return (
      <section className="deep-panel question-panel">
        <h2>还有一项信息需要确认</h2>
        <p className="deep-lead">部分答案发生了变化，请返回补全后再确认摘要。</p>
        <button className="primary-button" onClick={repairInvalidSummary} type="button">返回补全</button>
      </section>
    );
    return <CareerCalibrationSummary
      calibration={calibration}
      onConfirm={() => dispatch({ type: 'confirmSummary', calibration })}
      onEdit={() => dispatch({ type: 'editSummary' })}
    />;
  }
  if (state.step === 'payment') return (
    <section className="deep-panel payment-panel">
      <p className="eyebrow">职业专项分析</p>
      <h2>你的职业专项分析已经准备好</h2>
      <p className="deep-lead">报告会单向继承基础结论，再用你确认的现实约束与职业资本筛选可行方向。</p>
      <p className="price-label">{price}</p>
      {flowError ? <div className="flow-error" role="alert"><strong>{flowError.title}</strong><span>{flowError.detail}</span></div> : null}
      {state.paymentReceipt ? <p className="mock-note">已完成支付，无需重复付款。</p> : null}
      <div className="deep-actions deep-actions-payment">
        <button className="secondary-button" onClick={() => dispatch({ type: 'editSummary' })} type="button">修改摘要</button>
        <button className="primary-button" disabled={paymentBusy} onClick={startPayment} type="button">
          {paymentMode === 'alipay_sandbox'
            ? (paymentBusy ? '正在连接支付宝…' : '前往支付宝沙箱付款')
            : (paymentBusy ? '正在准备…' : '生成我的职业专项报告')}
        </button>
      </div>
      <p className="mock-note">{paymentMode === 'alipay_sandbox'
        ? '沙箱环境只使用测试账号与测试资金，不会从真实账户扣款。'
        : '当前为体验模式，本次不会实际扣款。'}</p>
    </section>
  );
  if (state.step === 'generating') return (
    <DeepGeneratingModal onCancel={() => generationControllerRef.current?.abort()} stage={generationStage} />
  );
  if (state.step === 'report' && state.report) return (
    <section className="deep-panel deep-report-ready">
      <p className="eyebrow">职业专项报告已生成</p>
      <h2>{state.report.title}</h2>
      <p className="deep-lead">完整报告已放在独立阅读页面中。</p>
      <button className="primary-button" onClick={() => router.push('/deep-report')} type="button">查看职业专项报告</button>
    </section>
  );
  return null;
}
