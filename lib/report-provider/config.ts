const providers = ['gemini', 'sample'] as const;

export type ReportProvider = (typeof providers)[number];

/**
 * `sample` keeps local UI and flow work free: every report is generated from
 * fixed local content and no Gemini request is made. Anything else (including
 * an unset value) uses the real Gemini provider.
 */
export function getReportProvider(): ReportProvider {
  const configured = process.env.REPORT_PROVIDER?.trim().toLowerCase();
  return providers.includes(configured as ReportProvider) ? (configured as ReportProvider) : 'gemini';
}

export function usesSampleReports() {
  return getReportProvider() === 'sample';
}
