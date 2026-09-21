'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';

import type { Report } from '@/lib/gemini/schema';
import { QUESTION_BANK_V1 } from '@/lib/deep-analysis/questions';
import { createFreeReportSummary } from '@/lib/deep-analysis/summaries';
import { consumeDeepReportStream } from '@/lib/deep-analysis/stream';
import { createInitialDeepState, deepFlowReducer, loadDeepSession, saveDeepSession } from '@/lib/deep-analysis/session';
import type { AnswerValue, FixedDirectionId } from '@/lib/deep-analysis/types';
import { DirectionPicker } from './direction-picker';
import { DeepGeneratingModal } from './deep-generating-modal';
import { DeepReportView } from './deep-report-view';
import { QuestionStep } from './question-step';

type BirthInput = { birthDate: string; birthTime: string | null; birthRegion: string };

const paymentTitles = {
  work: '你的职业方向深度分析已经准备好',
  industry: '你的行业方向深度分析已经准备好',
  city: '你的城市发展深度分析已经准备好',
  collaboration: '你的工作环境与合作关系深度分析已经准备好',
  custom: '你的专项问题深度分析已经准备好',
} as const;

export function DeepAnalysisFlow({ birthInput, freeReport, price }: { birthInput: BirthInput; freeReport: Report; price: string }) {
  const [state, dispatch] = useReducer(
    deepFlowReducer,
    createInitialDeepState('pending-session', { birthInput, freeReport }),
  );
  const [hydrated, setHydrated] = useState(false);
  const [generationStage, setGenerationStage] = useState('preparing');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadDeepSession(window.sessionStorage);
      if (restored?.birthInput && restored.freeReport) {
        dispatch({ type: 'restore', state: restored });
      } else {
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `session-${Date.now()}`;
        dispatch({ type: 'restore', state: createInitialDeepState(id, { birthInput, freeReport }) });
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [birthInput, freeReport]);

  useEffect(() => {
    if (hydrated) saveDeepSession(state, window.sessionStorage);
  }, [hydrated, state]);

  const questions = useMemo(() => state.selectedDirection === 'custom'
    ? state.customQuestions
    : state.selectedDirection ? QUESTION_BANK_V1[state.selectedDirection as FixedDirectionId] : [], [state.selectedDirection, state.customQuestions]);
  const question = questions[state.questionIndex];
  const currentAnswer = question ? state.answers[question.id] ?? {} : {};
  const answerReady = question?.type === 'text' ? Boolean(currentAnswer.textValue?.trim()) : Boolean(currentAnswer.optionIds?.length);

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

  async function generateReport() {
    try {
      let receipt = state.paymentReceipt;
      if (!receipt) {
        const payment = await fetch('/api/deep-analysis/payment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: state.sessionId, directionId: state.selectedDirection }) });
        const paymentData = await payment.json();
        if (!payment.ok || typeof paymentData.receipt !== 'string') throw new Error(paymentData.code || 'payment_failed');
        receipt = paymentData.receipt;
      }
      if (!receipt) throw new Error('payment_failed');
      setGenerationStage('preparing');
      dispatch({ type: 'generationStarted', receipt });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 255_000);
      try {
        const response = await fetch('/api/deep-analysis/report', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ sessionId: state.sessionId, paymentReceipt: receipt, birthInput, freeReport, selectedDirection: state.selectedDirection, questionnaireVersion: 'v1', answers: state.answers, optionalContext: state.optionalContext, customQuestion: state.selectedDirection === 'custom' ? state.customQuestion : null, customQuestions: state.customQuestions }) });
        if (!response.ok || !response.body) { const payload = await response.json().catch(() => ({})); throw new Error(payload.code || 'upstream_failed'); }
        dispatch({
          type: 'generationSucceeded',
          report: await consumeDeepReportStream(response.body, { onStatus: setGenerationStage }),
        });
      } finally { clearTimeout(timer); }
    } catch (error) { dispatch({ type: 'generationFailed', code: error instanceof Error ? error.message : 'upstream_failed' }); }
  }

  if (!hydrated) return <section aria-busy="true" className="deep-panel" />;
  if (state.step === 'direction') return <DirectionPicker onSelect={(directionId) => dispatch({ type: 'chooseDirection', directionId })} />;
  if (state.step === 'custom-question' || state.step === 'custom-loading') return <section className="deep-panel question-panel">
    <p className="step-label">自定义问题</p><h2>你最想弄清什么？</h2>
    <textarea aria-label="我的问题" disabled={state.step === 'custom-loading'} maxLength={1000} onChange={(event) => dispatch({ type: 'setCustomQuestion', value: event.target.value })} rows={5} value={state.customQuestion} />{state.errorCode ? <p className="form-error" role="alert">补充问题暂时无法生成，你的输入已保留，请重试。</p> : null}
    <div className="deep-actions"><button className="secondary-button" onClick={() => dispatch({ type: 'backToDirection' })} type="button">返回</button><button className="primary-button" disabled={state.step === 'custom-loading' || state.customQuestion.trim().length < 2} onClick={prepareCustomQuestions} type="button">{state.step === 'custom-loading' ? '正在判断是否需要补充…' : '继续'}</button></div>
  </section>;
  if (state.step === 'questions' && question) return <section className="deep-panel question-panel">
    <p className="step-label">第 {state.questionIndex + 1} / {questions.length} 题</p>
    <QuestionStep answer={currentAnswer} onChange={(answer: AnswerValue) => dispatch({ type: 'setAnswer', questionId: question.id, answer })} question={question} />
    <div className="deep-actions"><button className="secondary-button" onClick={() => dispatch({ type: 'previousQuestion' })} type="button">上一步</button><button className="primary-button" disabled={!answerReady} onClick={() => dispatch({ type: 'nextQuestion', total: questions.length })} type="button">继续</button></div>
  </section>;
  if (state.step === 'optional-context') return <section className="deep-panel question-panel"><p className="step-label">最后一步</p><h2>还有什么现实情况希望我们考虑？</h2><p className="deep-lead">例如收入压力、家庭情况、学历限制或已考虑的选项。这一步不是必填。</p><textarea aria-label="补充情况" maxLength={2000} onChange={(event) => dispatch({ type: 'setOptionalContext', value: event.target.value })} rows={6} value={state.optionalContext} /><button className="primary-button" onClick={() => dispatch({ type: 'goToPayment' })} type="button">查看深度报告说明</button></section>;
  if (state.step === 'payment') return <section className="deep-panel payment-panel"><p className="eyebrow">专项深度分析</p><h2>{state.selectedDirection ? paymentTitles[state.selectedDirection] : '你的深度分析已经准备好'}</h2><p className="deep-lead">系统会综合出生信息、基础报告、校准问题与补充信息，生成更具体的专项报告。</p><p className="price-label">{price}</p>{state.errorCode ? <p className="form-error" role="alert">上次操作未完成，你的答案已保留，可以重试。</p> : null}<button className="primary-button" onClick={generateReport} type="button">生成我的深度报告</button><p className="mock-note">当前为 Mock Payment，不会实际扣款。</p></section>;
  if (state.step === 'generating') return <DeepGeneratingModal stage={generationStage} />;
  if (state.step === 'report' && state.report) return <DeepReportView report={state.report} />;
  return null;
}
