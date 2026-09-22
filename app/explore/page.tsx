import type { Metadata } from 'next';

import { DeepExplorationPage } from '@/components/deep-analysis/deep-exploration-page';

export const metadata: Metadata = {
  title: '深入探索 | Jianvia',
  description: '围绕你关心的现实问题，继续完成个人专项探索。',
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
