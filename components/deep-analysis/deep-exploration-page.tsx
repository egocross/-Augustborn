'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { loadDeepSession, type DeepFlowState } from '@/lib/deep-analysis/session';
import { DeepAnalysisFlow } from './deep-analysis-flow';

export function DeepExplorationPage({ price, paymentMode = 'mock' }: { price: string; paymentMode?: 'mock' | 'alipay_sandbox' }) {
  const router = useRouter();
  const [session, setSession] = useState<DeepFlowState | null>();
  const [returnedOrderId, setReturnedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSession(loadDeepSession(window.sessionStorage));
      setReturnedOrderId(new URLSearchParams(window.location.search).get('payment_order'));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  if (session === undefined) {
    return (
      <section aria-busy="true" className="deep-exploration-page">
        <p className="eyebrow">专项探索</p>
        <h1>正在载入这次的探索记录</h1>
        <p>如果你刚从支付宝返回，页面会自动接着生成报告。</p>
      </section>
    );
  }

  if (!session?.birthInput || !session.freeReport) {
    return (
      <section className="deep-exploration-recovery">
        <p className="eyebrow">探索尚未开始</p>
        <h1>{returnedOrderId ? '这笔支付已经完成，但当前标签页没有对应的探索记录' : '当前标签页还没有可继续的探索内容'}</h1>
        <p>
          {returnedOrderId
            ? '深度报告需要出生信息、基础报告和校准答案，这些内容只保存在发起支付的那个标签页里。请回到发起支付的标签页继续查看，或重新开始一次探索。'
            : '请先返回首页填写出生信息并生成基础报告，再开始专项探索。'}
        </p>
        <button className="primary-button" onClick={() => router.push('/')} type="button">返回首页</button>
      </section>
    );
  }

  return (
    <div className="deep-exploration-page">
      <DeepAnalysisFlow birthInput={session.birthInput} freeReport={session.freeReport} paymentMode={paymentMode} price={price} returnedOrderId={returnedOrderId} />
    </div>
  );
}
