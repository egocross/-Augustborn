import { BirthForm } from '@/components/birth-form';

export default function Home() {
  return (
    <main className="site-shell">
      <BirthForm deepReportPrice={process.env.DEEP_REPORT_PRICE?.trim() || '¥29.90'} />
    </main>
  );
}
