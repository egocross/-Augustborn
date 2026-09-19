import 'server-only';

import type { BaziChart } from '@/lib/bazi/types';

import { GEMINI_PROVIDER } from './config';
import { generateReportWithGoogle } from './google-report';
import { generateReportWithKie } from './kie-report';
import type { Report } from './schema';

/** Generates a validated report with the configured provider, without retaining chart data. */
export const generateReport = (chart: BaziChart): Promise<Report> =>
  GEMINI_PROVIDER === 'google' ? generateReportWithGoogle(chart) : generateReportWithKie(chart);
