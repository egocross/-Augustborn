export const CAREER_EVENT_NAMES = [
  'career_calibration_started',
  'career_question_answered',
  'career_calibration_completed',
  'career_summary_confirmed',
  'career_report_generation_started',
  'career_report_generated',
] as const;

export type CareerEventName = (typeof CAREER_EVENT_NAMES)[number];

export type CareerEventMetadata = {
  questionId?: string;
  section?: string;
  skipped?: boolean;
  elapsedMs?: number;
};

/**
 * Privacy boundary for future product analytics. The V1 adapter intentionally
 * stores and transmits nothing; callers may provide only coarse lifecycle data.
 */
export function trackCareerEvent(
  _name: CareerEventName,
  _metadata: CareerEventMetadata = {},
): void {
  void _name;
  void _metadata;
  // No-op by design. Never add console logging or browser storage here.
}
