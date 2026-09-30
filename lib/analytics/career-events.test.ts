import { describe, expect, it } from 'vitest';

import { CAREER_EVENT_NAMES, trackCareerEvent, trackValidationEvent, VALIDATION_EVENT_NAMES } from './career-events';

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

  it('exposes only coarse validator lifecycle events', () => {
    expect(VALIDATION_EVENT_NAMES).toEqual([
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
    ]);
    expect(trackValidationEvent('experiment_started', {
      step: 'task', recovered: true, conflict: false, experimentMode: 'online_work_sample',
    })).toBeUndefined();

    if (false) {
      // @ts-expect-error Arbitrary event names must not compile.
      trackValidationEvent('career_validation_submitted', {});
      // @ts-expect-error Submission text is outside the analytics contract.
      trackValidationEvent('experiment_completed', { content: '我的提交正文' });
      // @ts-expect-error Public links and reflection answers must never enter analytics.
      trackValidationEvent('reflection_completed', { publicResultUrl: 'https://example.com', reflection: 'draining' });
    }
  });
});
