import type { Metadata } from 'next';

import { ValidationPage } from '@/components/career-validation/validation-page';

export const metadata: Metadata = {
  title: '职业方向验证 | Jianvia',
  description: '用一次低风险真实任务验证职业方向，而不是继续猜测。',
  robots: { index: false, follow: false },
};

export default async function CareerValidationRoute({ params }: { params: Promise<{ validationSessionId: string }> }) {
  const { validationSessionId } = await params;
  return (
    <main className="site-shell career-validation-shell">
      <ValidationPage validationSessionId={validationSessionId} />
    </main>
  );
}
