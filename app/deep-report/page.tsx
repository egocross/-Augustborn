import type { Metadata } from 'next';

import { DeepReportPage } from '@/components/deep-analysis/deep-report-page';

export const metadata: Metadata = {
  title: '专项探索报告 | Jianvia',
  description: '查看你的个人专项探索报告。',
  robots: { index: false, follow: false },
};

export default function DeepReportRoute() {
  return (
    <main className="site-shell deep-report-page-shell">
      <DeepReportPage />
    </main>
  );
}
