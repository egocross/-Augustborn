import { describe, expect, it } from 'vitest';

import { CAREER_EVENT_NAMES, trackCareerEvent } from './career-events';

describe('career analytics privacy seam', () => {
  it('exposes only the six approved lifecycle events', () => {
    expect(CAREER_EVENT_NAMES).toEqual([
      'career_calibration_started',
      'career_question_answered',
      'career_calibration_completed',
      'career_summary_confirmed',
      'career_report_generation_started',
      'career_report_generated',
    ]);
  });

  it('accepts only non-sensitive metadata and stores nothing by default', () => {
    expect(trackCareerEvent('career_question_answered', {
      questionId: 'career_status', section: 'current_state', skipped: false, elapsedMs: 800,
    })).toBeUndefined();

    if (false) {
      // @ts-expect-error Arbitrary event names must not compile.
      trackCareerEvent('career_income_recorded', {});
      // @ts-expect-error Raw answer text is outside the analytics contract.
      trackCareerEvent('career_question_answered', { answer: '我的具体收入' });
      // @ts-expect-error Income, family, and city data must never enter analytics.
      trackCareerEvent('career_question_answered', { income: 12000, family: '照护家人', city: '杭州' });
    }
  });
});
