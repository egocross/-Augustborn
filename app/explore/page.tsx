import type { Metadata } from 'next';

import { DeepExplorationPage } from '@/components/deep-analysis/deep-exploration-page';

export const metadata: Metadata = {
  title: '职业专项分析 | Jianvia',
  description: '用现实约束与职业资本校准基础倾向，收敛值得验证的职业方向。',
  robots: { index: false, follow: false },
};

export default function ExploreRoute() {
  return (
    <main className="site-shell deep-exploration-page-shell">
      <DeepExplorationPage
        paymentMode={process.env.PAYMENT_PROVIDER?.trim().toLowerCase() === 'alipay_sandbox' ? 'alipay_sandbox' : 'mock'}
        price={process.env.DEEP_REPORT_PRICE?.trim() || '¥29.90'}
      />
    </main>
  );
}
