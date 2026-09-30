export const CAREER_EVENT_NAMES = [
  'career_calibration_started',
  'career_question_answered',
  'career_calibration_completed',
  'career_summary_confirmed',
  'career_report_generation_started',
  'career_report_generated',
] as const;

export type CareerEventName = (typeof CAREER_EVENT_NAMES)[number];

export const VALIDATION_EVENT_NAMES = [
  'career_validation_started',
  'job_reality_viewed',
  'experiment_started',
  'experiment_completed',
  'reflection_completed',
  'validation_result_viewed',
  'next_action_viewed',
  'next_experiment_clicked',
  'career_validation_deleted',
  'career_validation_abandoned',
] as const;

export type ValidationEventName = (typeof VALIDATION_EVENT_NAMES)[number];

export type ValidationEventMetadata = {
  step?: string;
  recovered?: boolean;
  conflict?: boolean;
  experimentMode?: string;
  nextActionType?: string;
  elapsedMs?: number;
};

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

/**
 * Validator analytics stay coarse: step names, lifecycle states and ids that
 * cannot be reversed into user content. Submission text, public links,
 * reflection answers and birth data must never reach this seam.
 */
export function trackValidationEvent(
  _name: ValidationEventName,
  _metadata: ValidationEventMetadata = {},
): void {
  void _name;
  void _metadata;
  // No-op by design. Never add console logging or browser storage here.
}
