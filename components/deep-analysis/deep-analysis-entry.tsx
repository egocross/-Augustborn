'use client';

import { useRouter } from 'next/navigation';

import type { Report } from '@/lib/gemini/schema';
import { createInitialCareerState, saveDeepSession } from '@/lib/deep-analysis/session';

export function DeepAnalysisEntry({
  baseReportSnapshotToken,
  freeReport,
}: {
  baseReportSnapshotToken: string;
  freeReport: Report;
}) {
  const router = useRouter();

  function openExploration() {
    const sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}`;
    const nextState = createInitialCareerState(sessionId, { baseReportSnapshotToken, freeReport });

    saveDeepSession(nextState, window.sessionStorage);
    router.push('/explore');
  }

  return (
    <section className="deep-panel deep-entry-panel">
      <div>
        <p className="eyebrow">职业专项分析</p>
        <h2>把基础倾向放进现实条件里校准</h2>
        <p className="deep-lead">用 2–4 分钟确认收入、地点、时间与职业资本，再收窄值得验证的职业方向。</p>
      </div>
      <button className="primary-button" disabled={!baseReportSnapshotToken} onClick={openExploration} type="button">开始职业专项分析</button>
    </section>
  );
}
