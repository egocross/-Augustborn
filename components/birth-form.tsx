'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { FeedbackForm } from '@/components/feedback-form';
import { GeneratingModal } from '@/components/generating-modal';
import { ReportView } from '@/components/report-view';
import { DeepAnalysisEntry } from '@/components/deep-analysis/deep-analysis-entry';
import { clearDeepSession, loadDeepSession, saveFreeReportContext } from '@/lib/deep-analysis/session';
import { consumeAnalyzeStream, extractCompleteSections } from '@/lib/analyze-stream';
import type { Report, ReportSection } from '@/lib/gemini/schema';

type FormState = {
  birthDate: string;
  birthTime: string;
  birthRegion: string;
  timeUnknown: boolean;
};

const initialFormState: FormState = {
  birthDate: '',
  birthTime: '',
  birthRegion: '',
  timeUnknown: false,
};

const fallbackError = '报告暂时无法生成，请稍后重试。';

const loadingStages = [
  '正在读取出生信息…',
  '正在梳理性格与优势线索…',
  '正在分析适合的工作方式与环境…',
  '正在生成报告章节…',
];

/** Oldest birth date the calculation supports. */
const EARLIEST_BIRTH_DATE = '1900-01-01';

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** The newest allowed birth date never changes during a visit. */
const subscribeToNothing = () => () => {};

export function BirthForm() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [report, setReport] = useState<Report | null>(null);
  const [liveSections, setLiveSections] = useState<ReportSection[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [loadingStage, setLoadingStage] = useState(0);
  const analyzeRef = useRef<AbortController | null>(null);
  // Marks a generation started in this tab, so its first streamed section can
  // bring the page back to the top without affecting restored reports.
  const pendingReportScrollRef = useRef(false);
  // Empty during server rendering so hydration matches, then the local date.
  const latestBirthDate = useSyncExternalStore(subscribeToNothing, localToday, () => '');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadDeepSession(window.sessionStorage);
      if (!restored?.birthInput || !restored.freeReport) return;
      setForm({
        ...restored.birthInput,
        birthTime: restored.birthInput.birthTime ?? '',
        timeUnknown: restored.birthInput.birthTime === null,
      });
      setReport(restored.freeReport);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status !== 'loading') {
      return;
    }

    // Advances through the stages and then stays put: a stage should never
    // travel backwards and imply the work restarted.
    const timer = setInterval(() => {
      setLoadingStage((current) => Math.min(current + 1, loadingStages.length - 1));
    }, 6000);

    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => () => analyzeRef.current?.abort(), []);

  useEffect(() => {
    if (!pendingReportScrollRef.current) return;
    if (!report && liveSections.length === 0) return;
    pendingReportScrollRef.current = false;
    // The submit button sits at the bottom of the form, so the replaced report
    // would otherwise open mid-document, below the first sections.
    window.scrollTo({ top: 0, left: 0 });
  }, [liveSections.length, report]);

  const [modalMounted, setModalMounted] = useState(false);
  const showModal = status === 'loading' && liveSections.length === 0;

  useEffect(() => {
    if (showModal) {
      return;
    }

    const timer = setTimeout(() => setModalMounted(false), 280);

    return () => clearTimeout(timer);
  }, [showModal]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function cancelAnalyze() {
    analyzeRef.current?.abort();
    analyzeRef.current = null;
    setStatus('idle');
    setLiveSections([]);
    setNotice('已取消生成。你可以修改信息后重新开始。');
  }

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');
    setErrorMessage('');
    setNotice('');
    setReport(null);
    setLiveSections([]);
    setLoadingStage(0);
    setModalMounted(true);
    pendingReportScrollRef.current = true;

    const input = {
      birthDate: form.birthDate,
      birthTime: form.timeUnknown || form.birthTime === '' ? null : form.birthTime,
      birthRegion: form.birthRegion,
    };

    const controller = new AbortController();
    analyzeRef.current = controller;

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload: unknown = await response.json().catch(() => null);
        const message = isErrorResponse(payload) ? payload.error : '';
        throw new Error(message || fallbackError);
      }

      let streamedJson = '';
      const finished = await consumeAnalyzeStream(response.body, {
        onDelta: (text) => {
          streamedJson += text;
          setLiveSections(extractCompleteSections(streamedJson));
        },
      });

      if (!isReport(finished)) {
        throw new Error(fallbackError);
      }

      setReport(finished);
      setStatus('idle');
      try {
        saveFreeReportContext({ birthInput: input, freeReport: finished }, window.sessionStorage);
      } catch {
        // Storage can be unavailable in private mode; the report still renders.
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus('idle');
        setLiveSections([]);
        return;
      }
      setStatus('error');
      setLiveSections([]);
      setErrorMessage(error instanceof Error ? error.message : fallbackError);
    } finally {
      if (analyzeRef.current === controller) analyzeRef.current = null;
    }
  }

  function startOver() {
    clearDeepSession(window.sessionStorage);
    setForm(initialFormState);
    setReport(null);
    setLiveSections([]);
    setStatus('idle');
    setErrorMessage('');
    setNotice('');
  }

  const modal = modalMounted
    ? createPortal(
      <GeneratingModal onCancel={cancelAnalyze} open={showModal} stage={loadingStages[loadingStage]} />,
      document.body,
    )
    : null;

  if (report || liveSections.length > 0) {
    return (
      <div className="result-stack">
        <header className="result-intro">
          <p className="eyebrow">探索报告</p>
          <h1>{report ? '关于你的探索报告' : '正在生成你的探索报告…'}</h1>
        </header>
        <ReportView
          pending={report === null}
          report={report ?? { sections: liveSections, disclaimer: '' }}
        />
        {report ? (
          <>
            <DeepAnalysisEntry
              birthInput={{ birthDate: form.birthDate, birthTime: form.timeUnknown || !form.birthTime ? null : form.birthTime, birthRegion: form.birthRegion }}
              freeReport={report}
            />
            <FeedbackForm />
            <button className="text-button" onClick={startOver} type="button">
              重新分析
            </button>
          </>
        ) : null}
        {modal}
      </div>
    );
  }

  return (
    <div className={showModal ? 'birth-flow is-generating' : 'birth-flow'}>
      <header className="landing-intro">
        <p className="eyebrow">个人探索报告</p>
        <h1>发现更适合你的方向</h1>
        <p className="landing-subtitle">
          从出生信息出发，生成一份关于性格倾向、优势特征、工作方式与环境偏好的个人探索报告。
        </p>
      </header>

      <div className="birth-layout">
        <form className="birth-form" onSubmit={analyze}>
          <fieldset className="form-section">
            <legend>填写出生信息</legend>

            <div className="field">
              <div className="field-label-row">
                <label className="field-label" htmlFor="birthDate">出生日期</label>
                <span className="field-required">必填</span>
              </div>
              <input
                aria-describedby="birthDate-hint"
                id="birthDate"
                max={latestBirthDate || undefined}
                min={EARLIEST_BIRTH_DATE}
                onChange={(changeEvent) => updateField('birthDate', changeEvent.target.value)}
                required
                type="date"
                value={form.birthDate}
              />
              <p className="field-hint" id="birthDate-hint">
                公历日期，按北京时间填写。
              </p>
            </div>

            <div className="field">
              <div className="field-label-row">
                <label className="field-label" htmlFor="birthTime">出生时间</label>
                <span className="field-required">必填</span>
              </div>
              <input
                aria-describedby="birthTime-hint"
                disabled={form.timeUnknown}
                id="birthTime"
                onChange={(changeEvent) => updateField('birthTime', changeEvent.target.value)}
                required={!form.timeUnknown}
                type="time"
                value={form.birthTime}
              />
              <label className="checkbox-label">
                <input
                  checked={form.timeUnknown}
                  onChange={(changeEvent) => updateField('timeUnknown', changeEvent.target.checked)}
                  type="checkbox"
                />
                <span>不知道准确出生时间</span>
              </label>
              <p className="field-hint" id="birthTime-hint">
                {form.timeUnknown
                  ? '时间未知时，报告会跳过依赖出生时间的分析。'
                  : '24 小时制，按北京时间填写。'}
              </p>
            </div>

            <div className="field">
              <div className="field-label-row">
                <label className="field-label" htmlFor="birthRegion">出生地区</label>
                <span className="field-optional">选填</span>
              </div>
              <input
                aria-describedby="birthRegion-hint"
                id="birthRegion"
                onChange={(changeEvent) => updateField('birthRegion', changeEvent.target.value)}
                placeholder="如：浙江杭州"
                type="text"
                value={form.birthRegion}
              />
              <p className="field-hint" id="birthRegion-hint">
                用于理解成长环境带来的偏好。
              </p>
            </div>
          </fieldset>

          <div className="form-actions">
            {status === 'error' ? (
              <p className="form-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
            {notice ? (
              <p className="form-notice" role="status">
                {notice}
              </p>
            ) : null}
            <button className="primary-button" disabled={status === 'loading'} type="submit">
              {status === 'loading' ? '正在生成…' : '生成我的探索报告'}
            </button>
            <p className="privacy-notice">
              出生信息不会写入账户或数据库。为了让报告在刷新后仍能查看，本标签页会临时保存，关闭标签页后自动清除。
            </p>
          </div>
        </form>
      </div>
      {modal}
    </div>
  );
}

function isErrorResponse(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';
}

function isReport(value: unknown): value is Report {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const report = value as Partial<Report>;
  return typeof report.disclaimer === 'string' && Array.isArray(report.sections);
}
