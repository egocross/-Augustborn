'use client';

import { useState } from 'react';

import { FeedbackForm } from '@/components/feedback-form';
import { ReportView } from '@/components/report-view';
import type { Report } from '@/lib/gemini/schema';

type BirthFields = {
  lunarYear: string;
  lunarMonth: string;
  lunarDay: string;
  hour: string;
  minute: string;
};

const initialFields: BirthFields = {
  lunarYear: '',
  lunarMonth: '',
  lunarDay: '',
  hour: '',
  minute: '',
};

export function BirthForm() {
  const [fields, setFields] = useState<BirthFields>(initialFields);
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  function updateField(field: keyof BirthFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    const input = {
      lunarYear: Number(fields.lunarYear),
      lunarMonth: Number(fields.lunarMonth),
      lunarDay: Number(fields.lunarDay),
      hour: Number(fields.hour),
      minute: Number(fields.minute),
    };

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const payload: unknown = await response.json();

      if (!response.ok || !isReport(payload)) {
        const message = isErrorResponse(payload) ? payload.error : '';
        throw new Error(message || '分析暂时不可用，请稍后重试。');
      }

      setReport(payload);
      setStatus('idle');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '分析暂时不可用，请稍后重试。');
    }
  }

  function startOver() {
    setFields(initialFields);
    setReport(null);
    setStatus('idle');
    setErrorMessage('');
  }

  if (report) {
    return (
      <div className="result-stack">
        <ReportView report={report} />
        <FeedbackForm />
        <button className="text-button" onClick={startOver} type="button">
          重新分析
        </button>
      </div>
    );
  }

  return (
    <div className="birth-flow">
      <header className="landing-intro">
        <p className="eyebrow">四柱 · 节气 · 五行</p>
        <h1>八字简析</h1>
        <p>以农历出生日期与中国标准时间，生成一份安静、克制的命理参考。</p>
      </header>

      <form className="birth-form" onSubmit={analyze}>
        <fieldset>
          <legend>农历出生日期</legend>
          <div className="date-grid">
            <label>
              农历年份
              <input
                aria-label="农历年份"
                max="2100"
                min="1900"
                onChange={(event) => updateField('lunarYear', event.target.value)}
                required
                type="number"
                value={fields.lunarYear}
              />
            </label>
            <label>
              农历月份
              <input
                aria-label="农历月份"
                max="12"
                min="1"
                onChange={(event) => updateField('lunarMonth', event.target.value)}
                required
                type="number"
                value={fields.lunarMonth}
              />
            </label>
            <label>
              农历日期
              <input
                aria-label="农历日期"
                max="30"
                min="1"
                onChange={(event) => updateField('lunarDay', event.target.value)}
                required
                type="number"
                value={fields.lunarDay}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>出生时间</legend>
          <p className="field-hint">使用中国标准时间（UTC+8），24 小时制。</p>
          <div className="time-grid">
            <label>
              小时
              <input
                aria-label="小时"
                max="23"
                min="0"
                onChange={(event) => updateField('hour', event.target.value)}
                required
                type="number"
                value={fields.hour}
              />
            </label>
            <span className="time-separator" aria-hidden="true">:</span>
            <label>
              分钟
              <input
                aria-label="分钟"
                max="59"
                min="0"
                onChange={(event) => updateField('minute', event.target.value)}
                required
                type="number"
                value={fields.minute}
              />
            </label>
          </div>
        </fieldset>

        <p className="privacy-notice">不保存出生信息。提交内容仅用于本次分析，报告只保留在当前页面内存中。</p>
        {status === 'error' ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        <button className="primary-button" disabled={status === 'loading'} type="submit">
          {status === 'loading' ? '正在分析…' : '开始分析'}
        </button>
      </form>
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
