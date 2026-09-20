'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { FeedbackForm } from '@/components/feedback-form';
import { GeneratingModal } from '@/components/generating-modal';
import { ReportView } from '@/components/report-view';
import { DeepAnalysisFlow } from '@/components/deep-analysis/deep-analysis-flow';
import { clearDeepSession, loadDeepSession } from '@/lib/deep-analysis/session';
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

export function BirthForm({ deepReportPrice = '¥29.90' }: { deepReportPrice?: string }) {
  const restored = typeof window !== 'undefined' ? loadDeepSession(window.sessionStorage) : null;
  const [form, setForm] = useState<FormState>(() => restored?.birthInput ? { ...restored.birthInput, birthTime: restored.birthInput.birthTime ?? '', timeUnknown: restored.birthInput.birthTime === null } : initialFormState);
  const [report, setReport] = useState<Report | null>(() => restored?.freeReport ?? null);
  const [liveSections, setLiveSections] = useState<ReportSection[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingStage, setLoadingStage] = useState(0);

  useEffect(() => {
    if (status !== 'loading') {
      return;
    }

    const timer = setInterval(() => {
      setLoadingStage((current) => (current + 1) % loadingStages.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [status]);

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

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');
    setErrorMessage('');
    setReport(null);
    setLiveSections([]);
    setLoadingStage(0);
    setModalMounted(true);

    const input = {
      birthDate: form.birthDate,
      birthTime: form.timeUnknown || form.birthTime === '' ? null : form.birthTime,
      birthRegion: form.birthRegion,
    };

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
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
    } catch (error) {
      setStatus('error');
      setLiveSections([]);
      setErrorMessage(error instanceof Error ? error.message : fallbackError);
    }
  }

  function startOver() {
    clearDeepSession(window.sessionStorage);
    setForm(initialFormState);
    setReport(null);
    setLiveSections([]);
    setStatus('idle');
    setErrorMessage('');
  }

  const modal = modalMounted
    ? createPortal(<GeneratingModal open={showModal} stage={loadingStages[loadingStage]} />, document.body)
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
            <FeedbackForm />
            <DeepAnalysisFlow
              birthInput={{ birthDate: form.birthDate, birthTime: form.timeUnknown || !form.birthTime ? null : form.birthTime, birthRegion: form.birthRegion }}
              freeReport={report}
              price={deepReportPrice}
            />
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
            <p className="form-section-note">三项信息用于生成报告，出生地区为选填。</p>

            <div className="field">
              <label className="field-label" htmlFor="birthDate">
                出生日期
              </label>
              <input
                aria-describedby="birthDate-hint"
                id="birthDate"
                onChange={(changeEvent) => updateField('birthDate', changeEvent.target.value)}
                required
                type="date"
                value={form.birthDate}
              />
              <p className="field-hint" id="birthDate-hint">
                公历日期，按北京时间填写
              </p>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="birthTime">
                出生时间
              </label>
              <input
                aria-describedby="birthTime-hint"
                disabled={form.timeUnknown}
                id="birthTime"
                onChange={(changeEvent) => updateField('birthTime', changeEvent.target.value)}
                required
                type="time"
                value={form.birthTime}
              />
              <label className="checkbox-label">
                <input
                  checked={form.timeUnknown}
                  onChange={(changeEvent) => updateField('timeUnknown', changeEvent.target.checked)}
                  type="checkbox"
                />
                不知道准确出生时间
              </label>
              <p className="field-hint" id="birthTime-hint">
                {form.timeUnknown
                  ? '时间未知时，报告会跳过依赖出生时间的分析。'
                  : '24 小时制，按北京时间填写；若记不清可勾选上方选项。'}
              </p>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="birthRegion">
                出生地区
              </label>
              <input
                aria-describedby="birthRegion-hint"
                id="birthRegion"
                onChange={(changeEvent) => updateField('birthRegion', changeEvent.target.value)}
                placeholder="如：浙江杭州"
                type="text"
                value={form.birthRegion}
              />
              <p className="field-hint" id="birthRegion-hint">
                选填，仅用于理解你的成长环境带来的偏好。
              </p>
            </div>
          </fieldset>

          <div className="form-actions">
            {status === 'error' ? (
              <p className="form-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <button className="primary-button" disabled={status === 'loading'} type="submit">
              {status === 'loading' ? '正在生成…' : '生成我的探索报告'}
            </button>
            <p className="privacy-notice">
              不保存出生信息。提交内容仅用于本次分析，报告只保留在当前页面内存中。
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
