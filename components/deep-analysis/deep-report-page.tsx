'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { deepFlowReducer, loadDeepSession, saveDeepSession, type DeepFlowState } from '@/lib/deep-analysis/session';
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

  if (state?.step !== 'report' || !state.report) {
    return (
      <section className="deep-report-recovery">
        <p className="eyebrow">报告未找到</p>
        <h1>这份深度报告已不在当前标签页中</h1>
        <p>为了保护你的隐私，报告只临时保留在生成它的浏览器标签页内。你可以返回首页重新生成。</p>
        <button className="primary-button" onClick={() => router.push('/')} type="button">返回首页</button>
      </section>
    );
  }

  function chooseAnotherDirection() {
    if (!state) return;
    const resetState = deepFlowReducer(state, { type: 'backToDirection' });
    saveDeepSession(resetState, window.sessionStorage);
    router.push('/');
  }

  return (
    <div className="deep-report-page">
      <nav aria-label="报告操作" className="deep-report-toolbar">
        <div className="deep-report-toolbar-copy">
          <p className="eyebrow">个人专项探索</p>
          <p>报告已完成，你可以按自己的节奏阅读。</p>
        </div>
        <button className="secondary-button" onClick={() => router.push('/')} type="button">返回基础报告</button>
      </nav>

      <DeepReportView report={state.report} />

      <section className="deep-report-page-actions">
        <div>
          <p className="eyebrow">继续探索</p>
          <h2>还有其他问题想弄清楚？</h2>
          <p>返回基础报告，选择另一个方向重新回答。</p>
        </div>
        <button className="primary-button" onClick={chooseAnotherDirection} type="button">重新选择探索方向</button>
      </section>
    </div>
  );
}
