'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { trackValidationEvent } from '@/lib/analytics/career-events';
import { clearValidationLocal, loadValidationLocal, saveValidationLocal, type ValidationLocalStep } from '@/lib/career-validation/local';
import type { CareerExperiment, CareerValidationSession, Reflection, ValidationResult } from '@/lib/career-validation/schema';
import { loadDeepSession } from '@/lib/deep-analysis/session';

import { ValidationResultView } from './validation-result';

const REPORT_FALLBACK = '/deep-report';

type Screen = 'loading' | 'ready' | 'error' | 'gone' | 'deleted';
type FlowStep = 'overview' | 'task' | 'submission' | 'reflection' | 'result';

const STEP_ITEMS: Array<{ id: FlowStep; label: string }> = [
  { id: 'overview', label: '任务概览' },
  { id: 'task', label: '执行说明' },
  { id: 'submission', label: '提交结果' },
  { id: 'reflection', label: '固定复盘' },
  { id: 'result', label: '验证结果' },
];

const MODE_LABELS: Record<CareerExperiment['executionMode'], string> = {
  online_work_sample: '在线工作样本',
  offline_low_risk_experience: '低风险线下体验',
  job_reality_review: '岗位真相核对',
  core_work_awareness: '核心工作认知',
};

const REFLECTION_FIELDS = [
  { id: 'engagement', label: '投入感受', options: [['time_flew', '做的时候时间过得很快'], ['neutral', '说不上来'], ['draining', '越做越累']] },
  { id: 'persistence', label: '坚持方式', options: [['naturally_continued', '自然地想继续做下去'], ['forced_continue', '需要逼自己继续'], ['wanted_to_stop', '中途就想停下']] },
  { id: 'repeatWillingness', label: '再做一次的意愿', options: [['willing', '愿意再做一次'], ['uncertain', '不确定'], ['unwilling', '不愿意']] },
  { id: 'difficulty', label: '难度感受', options: [['too_easy', '太简单'], ['manageable', '刚好能完成'], ['too_hard', '太难了']] },
] as const;

type ErrorInfo = { code: string; message: string; retryable: boolean };

async function postJson(url: string, body: unknown, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { response, payload };
}

function isCompleteReflection(value: Partial<Reflection>): value is Reflection {
  return value.engagement !== undefined && value.persistence !== undefined
    && value.repeatWillingness !== undefined && value.difficulty !== undefined;
}

function deriveStep(session: CareerValidationSession, envelopeStep?: ValidationLocalStep | null): FlowStep {
  if (session.result) return 'result';
  if (session.status === 'submitted' || session.status === 'analyzing' || session.status === 'analysis_failed') return 'reflection';
  if (session.submission) return 'reflection';
  if (envelopeStep === 'task' || envelopeStep === 'submission') return envelopeStep;
  return 'overview';
}

function readAccessCapability(validationSessionId: string): string | null {
  const state = loadDeepSession(window.sessionStorage);
  return state?.validationAccess.find((item) => item.validationSessionId === validationSessionId)?.capability ?? null;
}

export function ValidationPage({ validationSessionId }: { validationSessionId: string }) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('loading');
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [session, setSession] = useState<CareerValidationSession | null>(null);
  const [experiment, setExperiment] = useState<CareerExperiment | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [step, setStep] = useState<FlowStep>('overview');
  const [content, setContent] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [reflection, setReflection] = useState<Partial<Reflection>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<null | 'experiment' | 'save' | 'submit' | 'analyze' | 'delete' | 'next'>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ latestRevision: number } | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [revisionState, setRevisionState] = useState(1);

  const capabilityRef = useRef('');
  const retentionRef = useRef<string>('2099-01-01T00:00:00.000Z');
  const revisionRef = useRef(1);
  const contentRef = useRef('');
  const publicUrlRef = useRef('');
  const reflectionRef = useRef<Partial<Reflection>>({});
  const notesRef = useRef('');
  const sessionRef = useRef<CareerValidationSession | null>(null);
  const experimentRequestedRef = useRef(false);
  const stepsTrackedRef = useRef(new Set<string>());

  const updateContent = useCallback((value: string) => { contentRef.current = value; setContent(value); }, []);
  const updatePublicUrl = useCallback((value: string) => { publicUrlRef.current = value; setPublicUrl(value); }, []);
  const updateReflection = useCallback((value: Partial<Reflection>) => { reflectionRef.current = value; setReflection(value); }, []);
  const updateNotes = useCallback((value: string) => { notesRef.current = value; setNotes(value); }, []);
  const updateRevision = useCallback((value: number) => { revisionRef.current = value; setRevisionState(value); }, []);
  const updateStep = useCallback((value: FlowStep) => setStep(value), []);

  const trackOnce = useCallback((key: string, run: () => void) => {
    if (stepsTrackedRef.current.has(key)) return;
    stepsTrackedRef.current.add(key);
    run();
  }, []);

  const handleGone = useCallback(() => {
    try { clearValidationLocal(window.localStorage, validationSessionId); } catch { /* local cleanup is best effort */ }
    setScreen('gone');
  }, [validationSessionId]);

  const patchSession = useCallback(async (patch: Record<string, unknown>, revision: number) => {
    const { response, payload } = await postJson('/api/career-validation/session', {
      capability: capabilityRef.current, expectedRevision: revision, patch,
    }, 'PATCH');
    if (response.ok && payload.session) {
      const next = payload.session as CareerValidationSession;
      sessionRef.current = next;
      setSession(next);
      updateRevision(next.revision);
      setConflict(null);
      return { ok: true as const, session: next };
    }
    if (response.status === 409 && payload.code === 'VERSION_CONFLICT') {
      const latestRevision = typeof payload.latestRevision === 'number' ? payload.latestRevision : revision + 1;
      setConflict({ latestRevision });
      return { ok: false as const, conflict: true as const };
    }
    if (response.status === 410) { handleGone(); return { ok: false as const }; }
    setNotice('保存失败，请稍后重试。你的内容仍保留在输入框里。');
    return { ok: false as const };
  }, [handleGone, updateRevision]);

  const loadExperiment = useCallback(async () => {
    const token = capabilityRef.current;
    if (!token || experimentRequestedRef.current) return;
    experimentRequestedRef.current = true;
    setBusy('experiment');
    setNotice(null);
    try {
      const { response, payload } = await postJson('/api/career-validation/experiment', { capability: token });
      if (response.ok && payload.experiment) {
        setExperiment(payload.experiment as CareerExperiment);
      } else if (response.status === 202) {
        experimentRequestedRef.current = false;
        setNotice('验证任务正在生成，请稍后点击重试。');
      } else if (response.status === 410) {
        handleGone();
      } else {
        experimentRequestedRef.current = false;
        setNotice('验证任务生成失败，请重试。');
      }
    } catch {
      experimentRequestedRef.current = false;
      setNotice('网络连接失败，请重试。');
    } finally {
      setBusy(null);
    }
  }, [handleGone]);

  const applySession = useCallback((next: CareerValidationSession, envelopeStep?: ValidationLocalStep | null, localDraft?: { content: string; publicResultUrl: string }) => {
    sessionRef.current = next;
    setSession(next);
    updateRevision(next.revision);
    retentionRef.current = next.retentionExpiresAt;
    const serverContent = next.submission?.content ?? '';
    const keptContent = localDraft?.content && localDraft.content !== serverContent ? localDraft.content : serverContent;
    updateContent(keptContent);
    updatePublicUrl(next.submission?.publicResultUrl ?? localDraft?.publicResultUrl ?? '');
    const nextReflection: Partial<Reflection> = next.reflection ?? {};
    updateReflection(nextReflection);
    updateNotes(nextReflection.notes ?? '');
    if (localDraft?.content && localDraft.content !== serverContent) {
      setNotice('检测到当前浏览器里有未同步的草稿，已保留在输入框；提交前请确认要使用哪一版。');
    }
    if (next.experiment) setExperiment(next.experiment);
    if (next.result) {
      setResult(next.result);
      updateStep('result');
      trackOnce('result', () => {
        trackValidationEvent('validation_result_viewed', { nextActionType: next.result?.nextAction.type });
        trackValidationEvent('next_action_viewed', { nextActionType: next.result?.nextAction.type });
      });
      return;
    }
    updateStep(deriveStep(next, envelopeStep));
    if (!next.experiment) void loadExperiment();
  }, [loadExperiment, trackOnce, updateContent, updateNotes, updatePublicUrl, updateReflection, updateRevision, updateStep]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let envelope = null;
      try { envelope = loadValidationLocal(window.localStorage, validationSessionId); } catch { setStorageWarning(true); }
      let accessToken: string | null = null;
      try { accessToken = readAccessCapability(validationSessionId); } catch { accessToken = null; }
      const token = accessToken ?? envelope?.capability ?? null;
      if (!token) {
        if (!cancelled) {
          setErrorInfo({ code: 'NO_ACCESS', message: '没有找到这次验证的入口。请回到职业专项报告，从对应方向重新开始。', retryable: false });
          setScreen('error');
        }
        return;
      }
      capabilityRef.current = token;
      if (!accessToken && envelope) setRecovered(true);
      try {
        const response = await fetch('/api/career-validation/session', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ capability: token }),
        });
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (cancelled) return;
        if (!response.ok) {
          if (response.status === 410) { handleGone(); return; }
          setErrorInfo({
            code: typeof payload.code === 'string' ? payload.code : 'VALIDATION_UNAVAILABLE',
            message: '这次验证暂时打不开，请稍后重试。', retryable: true,
          });
          setScreen('error');
          return;
        }
        const next = payload.session as CareerValidationSession;
        setScreen('ready');
        applySession(next, envelope?.step ?? null, envelope ? { content: envelope.draft.content, publicResultUrl: envelope.draft.publicResultUrl } : undefined);
        trackOnce('started', () => trackValidationEvent('career_validation_started', { recovered: envelope !== null }));
      } catch {
        if (!cancelled) {
          setErrorInfo({ code: 'NETWORK', message: '网络连接失败，请稍后重试。', retryable: true });
          setScreen('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [applySession, handleGone, trackOnce, validationSessionId]);

  useEffect(() => {
    if (screen !== 'ready' || !capabilityRef.current) return;
    const localStep: ValidationLocalStep = step === 'result' ? 'reflection' : step;
    try {
      saveValidationLocal(window.localStorage, {
        validationSessionId, capability: capabilityRef.current, revision: revisionRef.current, step: localStep,
        draft: {
          content: contentRef.current, publicResultUrl: publicUrlRef.current,
          reflection: reflectionRef.current as Record<string, string>, notes: notesRef.current,
        },
        retentionExpiresAt: retentionRef.current, updatedAt: new Date().toISOString(),
      });
    } catch {
      window.setTimeout(() => setStorageWarning(true), 0);
    }
  }, [content, notes, publicUrl, reflection, revisionState, screen, step, validationSessionId]);

  const flushDraft = useCallback(async () => {
    const bodyContent = contentRef.current.trim();
    if (bodyContent.length < 20) return true;
    setBusy('save');
    const patch: Record<string, unknown> = {
      submission: {
        format: 'markdown', content: bodyContent, attachments: [],
        ...(publicUrlRef.current.trim() ? { publicResultUrl: publicUrlRef.current.trim() } : {}),
      },
    };
    const outcome = await patchSession(patch, revisionRef.current);
    setBusy(null);
    return outcome.ok;
  }, [patchSession]);

  useEffect(() => {
    if (screen !== 'ready' || step !== 'submission' || conflict) return;
    if (contentRef.current.trim().length < 20) return;
    const timer = window.setTimeout(() => { void flushDraft(); }, 1200);
    return () => window.clearTimeout(timer);
  }, [conflict, content, flushDraft, publicUrl, screen, step]);

  const runAnalysis = useCallback(async () => {
    setBusy('analyze');
    setNotice(null);
    try {
      const { response, payload } = await postJson('/api/career-validation/analyze', { capability: capabilityRef.current });
      if (response.ok && payload.result) {
        const nextResult = payload.result as ValidationResult;
        setResult(nextResult);
        updateStep('result');
        trackOnce('result', () => {
          trackValidationEvent('validation_result_viewed', { nextActionType: nextResult.nextAction.type });
          trackValidationEvent('next_action_viewed', { nextActionType: nextResult.nextAction.type });
        });
      } else if (response.status === 202) {
        setNotice('分析还在进行中，请稍后重试。');
      } else if (response.status === 410) {
        handleGone();
      } else {
        setNotice('分析暂时失败，你的提交已经保存，可以直接重试。');
      }
    } catch {
      setNotice('网络连接失败，你的提交已经保存，可以直接重试。');
    } finally {
      setBusy(null);
    }
  }, [handleGone, trackOnce, updateStep]);

  const handleSubmissionContinue = useCallback(async () => {
    if (contentRef.current.trim().length < 20) return;
    const saved = await flushDraft();
    if (saved) updateStep('reflection');
  }, [flushDraft, updateStep]);

  const handleReflectionSubmit = useCallback(async () => {
    const answers = reflectionRef.current;
    if (!isCompleteReflection(answers)) return;
    const bodyContent = contentRef.current.trim();
    if (bodyContent.length < 20) { setNotice('提交内容太短，请补充后再提交。'); return; }
    setBusy('submit');
    const outcome = await patchSession({
      submission: {
        format: 'markdown', content: bodyContent, attachments: [],
        ...(publicUrlRef.current.trim() ? { publicResultUrl: publicUrlRef.current.trim() } : {}),
      },
      reflection: { ...answers, ...(notesRef.current.trim() ? { notes: notesRef.current.trim() } : {}) },
      status: 'submitted',
    }, revisionRef.current);
    setBusy(null);
    if (!outcome.ok) return;
    trackOnce('experiment_completed', () => trackValidationEvent('experiment_completed', {}));
    trackOnce('reflection_completed', () => trackValidationEvent('reflection_completed', {}));
    await runAnalysis();
  }, [patchSession, runAnalysis, trackOnce]);

  const useServerVersion = useCallback(async () => {
    setBusy('save');
    try {
      const { response, payload } = await postJson('/api/career-validation/session', { capability: capabilityRef.current });
      if (response.ok && payload.session) {
        const next = payload.session as CareerValidationSession;
        sessionRef.current = next;
        setSession(next);
        updateRevision(next.revision);
        updateContent(next.submission?.content ?? '');
        updatePublicUrl(next.submission?.publicResultUrl ?? '');
        setConflict(null);
        setNotice('已使用服务器上的最新版本。');
      } else if (response.status === 410) { handleGone(); }
      else setNotice('读取最新版本失败，请稍后重试。');
    } catch {
      setNotice('网络连接失败，请稍后重试。');
    } finally {
      setBusy(null);
    }
  }, [handleGone, updateContent, updatePublicUrl, updateRevision]);

  const keepLocalAndRetry = useCallback(async () => {
    if (!conflict) return;
    revisionRef.current = conflict.latestRevision;
    setConflict(null);
    const saved = await flushDraft();
    if (saved && step === 'submission') updateStep('reflection');
  }, [conflict, flushDraft, step, updateStep]);

  const handleStartNext = useCallback(async () => {
    setBusy('next');
    setNotice(null);
    try {
      const { response, payload } = await postJson('/api/career-validation/next', { capability: capabilityRef.current });
      if (response.ok && typeof payload.validationSessionId === 'string' && typeof payload.capability === 'string') {
        try {
          saveValidationLocal(window.localStorage, {
            validationSessionId: payload.validationSessionId, capability: payload.capability, revision: 1,
            step: 'overview', draft: { content: '', publicResultUrl: '', reflection: {} },
            retentionExpiresAt: retentionRef.current, updatedAt: new Date().toISOString(),
          });
        } catch { setStorageWarning(true); }
        trackValidationEvent('next_experiment_clicked', { nextActionType: 'in_product_experiment' });
        router.push(`/career-validation/${payload.validationSessionId}`);
      } else if (response.status === 410) { handleGone(); }
      else setNotice('暂时无法创建下一轮验证，请稍后重试。');
    } catch {
      setNotice('网络连接失败，请稍后重试。');
    } finally {
      setBusy(null);
    }
  }, [handleGone, router]);

  const handleDelete = useCallback(async () => {
    setBusy('delete');
    try {
      const { response, payload } = await postJson('/api/career-validation/session', { capability: capabilityRef.current }, 'DELETE');
      if (response.ok && payload.deleted) {
        try { clearValidationLocal(window.localStorage, validationSessionId); } catch { /* best effort */ }
        trackValidationEvent('career_validation_deleted', {});
        setConfirmingDelete(false);
        setScreen('deleted');
      } else if (response.status === 410) { handleGone(); }
      else setNotice('删除失败，请稍后重试。');
    } catch {
      setNotice('网络连接失败，请稍后重试。');
    } finally {
      setBusy(null);
    }
  }, [handleGone, validationSessionId]);

  if (screen === 'loading') {
    return <section aria-busy="true" aria-label="正在打开这次验证" className="validation-screen validation-loading">
      <p className="eyebrow">职业验证</p>
      <h1>正在打开这次验证…</h1>
      <p>正在读取上一次冻结的验证上下文。</p>
    </section>;
  }

  if (screen === 'error') {
    return <section className="validation-screen validation-recovery">
      <p className="eyebrow">暂时打不开</p>
      <h1>这次验证暂时无法打开</h1>
      <p>{errorInfo?.message}</p>
      {errorInfo?.retryable ? <button className="primary-button" onClick={() => window.location.reload()} type="button">重新加载</button> : null}
      <a className="secondary-button" href={REPORT_FALLBACK}>返回职业报告</a>
    </section>;
  }

  if (screen === 'gone') {
    return <section className="validation-screen validation-recovery">
      <p className="eyebrow">已结束</p>
      <h1>本次验证已结束或已被删除</h1>
      <p>旧链接不能再恢复这份记录；基础报告、职业专项报告和支付记录不受影响。</p>
      <a className="primary-button" href={REPORT_FALLBACK}>返回职业报告</a>
    </section>;
  }

  if (screen === 'deleted') {
    return <section className="validation-screen validation-recovery">
      <p className="eyebrow">已删除</p>
      <h1>本次验证记录已删除</h1>
      <p>删除无法撤销；基础报告和职业专项报告不受影响，你随时可以重新发起一次验证。</p>
      <a className="primary-button" href={REPORT_FALLBACK}>返回职业报告</a>
    </section>;
  }

  const snapshot = session?.validationContextSnapshot ?? null;

  return <div className="career-validation-page">
    <nav aria-label="验证步骤" className="validation-steps">
      <ol>{STEP_ITEMS.map((item, index) => <li aria-current={step === item.id ? 'step' : undefined} className={step === item.id ? 'is-current' : index < STEP_ITEMS.findIndex((entry) => entry.id === step) ? 'is-done' : ''} key={item.id}>
        <span aria-hidden="true">{index + 1}</span>{item.label}
      </li>)}</ol>
    </nav>

    {storageWarning ? <p className="validation-warning" role="status">当前浏览器无法保存本地草稿，关闭页面后本次进度可能无法恢复；提交前的服务器保存仍然有效。</p> : null}
    {recovered && step !== 'result' ? <p className="validation-recovered" role="status">已恢复上次未提交的草稿（仅限当前浏览器；换设备不会同步）。</p> : null}
    {conflict ? <section className="validation-conflict" role="alert">
      <h2>另一处已更新了这份记录</h2>
      <p>你的草稿仍保留在这里，没有被覆盖。请选择要用哪一版。</p>
      <div className="validation-conflict-actions">
        <button className="secondary-button" disabled={busy !== null} onClick={useServerVersion} type="button">使用服务器版本</button>
        <button className="primary-button" disabled={busy !== null} onClick={keepLocalAndRetry} type="button">保留我的草稿并重试</button>
      </div>
    </section> : null}
    {notice ? <p className="validation-notice" role="status">{notice}</p> : null}

    {!experiment && step !== 'result' ? <section aria-busy={busy === 'experiment'} className="validation-screen validation-generating">
      <p className="eyebrow">准备任务</p>
      <h1>{busy === 'experiment' ? '正在生成你的验证任务…' : '验证任务还没生成好'}</h1>
      <p>任务只依据已冻结的报告上下文生成；如果失败可以安全重试。</p>
      {busy !== 'experiment' ? <button className="primary-button" onClick={() => { experimentRequestedRef.current = false; void loadExperiment(); }} type="button">生成验证任务</button> : null}
    </section> : null}

    {experiment && step === 'overview' ? <section className="validation-step validation-overview">
      <header className="validation-step-head">
        <p className="eyebrow">验证任务</p>
        <h1>{experiment.title}</h1>
        <p className="validation-question">{experiment.validationQuestion}</p>
        <p className="validation-meta">{MODE_LABELS[experiment.executionMode]} · 预计 {experiment.estimatedMinutes} 分钟</p>
      </header>

      <section aria-label="AI 综合分析" className="validation-synthesis" data-testid="ai-synthesis">
        <h2>AI 综合分析</h2>
        <p><b>假设：</b>{experiment.hypothesis}</p>
        <p><b>场景：</b>{experiment.scenario}</p>
        <p><b>目标：</b>{experiment.objective}</p>
        {experiment.limitationNote ? <p className="validation-limit"><b>边界：</b>{experiment.limitationNote}</p> : null}
      </section>

      <section aria-label="来源事实" className="validation-facts" data-testid="source-facts">
        <h2>来源事实</h2>
        <p className="validation-limit">{snapshot?.marketEvidence.limitationNote ?? '当前没有可用的市场来源说明。'}</p>
        {snapshot?.marketEvidence.sources.length
          ? <ul>{snapshot.marketEvidence.sources.map((source) => <li key={`${source.sourceName}-${source.fact}`}>
            <strong>{source.sourceName}</strong>
            <p>{source.fact}</p>
            {source.sourceUrl ? <a href={source.sourceUrl} rel="noopener noreferrer" target="_blank">查看来源<span aria-hidden="true">↗</span></a> : <small>未提供可点击来源</small>}
          </li>)}</ul>
          : <p className="validation-empty">当前没有服务端确认的公开来源，本任务不声称来自招聘市场。</p>}
      </section>
    </section> : null}

    {experiment && step === 'task' ? <section className="validation-step validation-task">
      <header className="validation-step-head">
        <p className="eyebrow">执行说明</p>
        <h1>任务执行说明</h1>
        <p className="validation-meta">给自己留出 {experiment.estimatedMinutes} 分钟，尽量一次做完。</p>
      </header>
      <section className="validation-block"><h2>执行步骤</h2><ol>{experiment.steps.map((item) => <li key={item}>{item}</li>)}</ol></section>
      {experiment.prerequisites.length ? <section className="validation-block"><h2>先确认门槛</h2><ul>{experiment.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
      {experiment.providedInformation.length ? <section className="validation-block"><h2>已提供的信息</h2><ul>{experiment.providedInformation.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
      <section className="validation-block"><h2>交付物</h2><p>{experiment.deliverable}</p></section>
      <section className="validation-block"><h2>合格标准</h2><ul className="validation-rubric">{experiment.rubric.map((item) => <li key={item.criterion}><strong>{item.criterion}</strong><p>{item.basicStandard}</p></li>)}</ul></section>
      {experiment.referenceStructure.length ? <section className="validation-block"><h2>参考结构</h2><ul>{experiment.referenceStructure.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
    </section> : null}

    {experiment && step === 'submission' ? <section className="validation-step validation-submission">
      <header className="validation-step-head">
        <p className="eyebrow">提交结果</p>
        <h1>把你的任务结果发给我</h1>
        <p>内容会按纯文本 Markdown 保存；公开链接只作为记录，不会被读取。</p>
      </header>
      <label className="validation-field"><span>Markdown 正文</span>
        <textarea onChange={(event) => updateContent(event.target.value)} placeholder="写下你的产出、关键取舍和不确定的地方。" rows={12} value={content} />
      </label>
      <p className="validation-field-help">Markdown 会以纯文本保存和展示，不会渲染 HTML。</p>
      <label className="validation-field"><span>公开成果链接（可选）</span>
        <input inputMode="url" onChange={(event) => updatePublicUrl(event.target.value)} placeholder="https://…" type="url" value={publicUrl} />
      </label>
      <p className="validation-field-help">只保存你填写的链接，AI 不会读取、抓取或预览链接内容。</p>
    </section> : null}

    {experiment && step === 'reflection' ? <section className="validation-step validation-reflection">
      <header className="validation-step-head">
        <p className="eyebrow">固定复盘</p>
        <h1>复盘这次任务</h1>
        <p>四道固定问题帮助区分“这次表现如何”和“愿不愿意长期做”。</p>
      </header>
      {REFLECTION_FIELDS.map((field) => <fieldset className="validation-reflection-group" key={field.id}>
        <legend>{field.label}</legend>
        <div className="validation-choice-row">{field.options.map(([value, label]) => <label className={`validation-choice${reflection[field.id] === value ? ' is-selected' : ''}`} key={value}>
          <input checked={reflection[field.id] === value} name={field.id} onChange={() => updateReflection({ ...reflectionRef.current, [field.id]: value })} type="radio" value={value} />
          <span>{label}</span>
        </label>)}</div>
      </fieldset>)}
      <label className="validation-field"><span>补充说明（可选）</span>
        <textarea onChange={(event) => updateNotes(event.target.value)} placeholder="还有什么想记下来的？" rows={4} value={notes} />
      </label>
      {session && ['submitted', 'analyzing', 'analysis_failed'].includes(session.status) && !result
        ? <section className="validation-block validation-analyzing" aria-busy={busy === 'analyze'}>
          <h2>{busy === 'analyze' ? '正在分析你的提交…' : '提交已保存，等待分析'}</h2>
          <p>分析只读取冻结实验、你的 Markdown、固定复盘和必要现实门槛。</p>
          {busy !== 'analyze' ? <button className="secondary-button" onClick={() => void runAnalysis()} type="button">开始分析 / 重试</button> : null}
        </section> : null}
    </section> : null}

    {result && step === 'result' ? <section className="validation-step validation-result-step">
      <ValidationResultView nextBusy={busy === 'next'} onStartNext={() => void handleStartNext()} result={result} />
      <section className="validation-danger">
        {confirmingDelete ? <div className="validation-confirm" role="alert">
          <h2>确认删除这次验证记录？</h2>
          <p>删除无法撤销；不影响基础报告、职业专项报告和支付记录。</p>
          <div className="validation-confirm-actions">
            <button className="secondary-button" disabled={busy === 'delete'} onClick={() => setConfirmingDelete(false)} type="button">取消</button>
            <button className="primary-button danger" disabled={busy === 'delete'} onClick={() => void handleDelete()} type="button">{busy === 'delete' ? '正在删除…' : '确认删除'}</button>
          </div>
        </div> : <button className="text-button validation-delete" onClick={() => setConfirmingDelete(true)} type="button">删除本次验证记录</button>}
      </section>
    </section> : null}

    <div className="validation-action-bar">
      {step === 'overview' && experiment ? <button className="primary-button" onClick={() => {
        trackValidationEvent('experiment_started', { experimentMode: experiment.executionMode });
        if (experiment.executionMode === 'job_reality_review') trackValidationEvent('job_reality_viewed', {});
        updateStep('task');
      }} type="button">开始这项任务</button> : null}
      {step === 'task' ? <>
        <button className="secondary-button" onClick={() => updateStep('overview')} type="button">上一步</button>
        <button className="primary-button" onClick={() => updateStep('submission')} type="button">准备好了，去提交</button>
      </> : null}
      {step === 'submission' ? <>
        <button className="secondary-button" onClick={() => updateStep('task')} type="button">上一步</button>
        <button className="primary-button" disabled={content.trim().length < 20 || busy === 'save'} onClick={() => void handleSubmissionContinue()} type="button">{busy === 'save' ? '正在保存…' : '保存草稿并继续'}</button>
      </> : null}
      {step === 'reflection' ? <>
        <button className="secondary-button" onClick={() => updateStep('submission')} type="button">上一步</button>
        <button className="primary-button" disabled={!isCompleteReflection(reflection) || busy === 'submit' || busy === 'analyze'} onClick={() => void handleReflectionSubmit()} type="button">{busy === 'submit' || busy === 'analyze' ? '正在分析…' : '提交并生成分析结果'}</button>
      </> : null}
    </div>
  </div>;
}
