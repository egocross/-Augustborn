'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { loadDeepSession, type DeepFlowState } from '@/lib/deep-analysis/session';
import { DeepReportView } from './deep-report-view';

export function DeepReportPage() {
  const router = useRouter();
  const [state, setState] = useState<DeepFlowState | null | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(loadDeepSession(window.sessionStorage));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (state === undefined) {
    return <section aria-busy="true" aria-label="正在打开深度报告" className="deep-report-page-loading" />;
  }

  const report = state?.report ?? null;

  if (!report) {
    return (
      <section className="deep-report-recovery">
        <p className="eyebrow">报告未找到</p>
        <h1>这份深度报告已不在当前标签页中</h1>
        <p>为了保护你的隐私，报告只临时保留在生成它的浏览器标签页内。你可以返回首页重新生成。</p>
        <button className="primary-button" onClick={() => router.push('/')} type="button">返回首页</button>
      </section>
    );
  }

  return (
    <div className="deep-report-page">
      <DeepReportView report={report} />
    </div>
  );
}
