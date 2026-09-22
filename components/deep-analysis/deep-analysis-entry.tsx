'use client';

import { useRouter } from 'next/navigation';

import type { Report } from '@/lib/gemini/schema';
import { createInitialDeepState, saveDeepSession } from '@/lib/deep-analysis/session';

type BirthInput = { birthDate: string; birthTime: string | null; birthRegion: string };

export function DeepAnalysisEntry({ birthInput, freeReport }: { birthInput: BirthInput; freeReport: Report }) {
  const router = useRouter();

  function openExploration() {
    const sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}`;
    const nextState = createInitialDeepState(sessionId, { birthInput, freeReport });

    saveDeepSession(nextState, window.sessionStorage);
    router.push('/explore');
  }

  return (
    <section className="deep-panel deep-entry-panel">
      <div>
        <p className="eyebrow">深入探索</p>
        <h2>把基础报告变成更具体的行动建议</h2>
        <p className="deep-lead">选择一个你现在最关心的问题，再用几道现实问题完成校准。</p>
      </div>
      <button className="primary-button" onClick={openExploration} type="button">开始深入探索</button>
    </section>
  );
}
