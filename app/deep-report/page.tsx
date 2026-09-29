import type { Metadata } from 'next';

import { DeepReportPage } from '@/components/deep-analysis/deep-report-page';

export const metadata: Metadata = {
  title: '职业专项报告 | Jianvia',
  description: '查看你的职业现实边界、可迁移资本、候选方向与 30 天验证计划。',
  robots: { index: false, follow: false },
};

export default function DeepReportRoute() {
  return (
    <main className="site-shell deep-report-page-shell">
      <DeepReportPage />
    </main>
  );
}
