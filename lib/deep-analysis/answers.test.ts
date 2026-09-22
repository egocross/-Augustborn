import { describe, expect, it } from 'vitest';

import { isDirectionComplete, validateDirectionAnswers } from './answers';

const validWorkAnswers = {
  work_q1: { optionIds: ['work_q1_employed_change'] },
  work_q2: { optionIds: ['work_q2_content', 'work_q2_design'] },
  work_q3: { optionIds: ['work_q3_ideas'] },
  work_q4: { optionIds: ['work_q4_repetitive', 'work_q4_controlled'] },
  work_q5: { optionIds: ['work_q5_growth', 'work_q5_balance'] },
};

describe('validateDirectionAnswers', () => {
  it('accepts a complete valid answer set', () => {
    expect(validateDirectionAnswers('work', validWorkAnswers).success).toBe(true);
    expect(isDirectionComplete('work', validWorkAnswers)).toBe(true);
  });

  it('rejects more than the configured multi-select limit', () => {
    const result = validateDirectionAnswers('work', {
      ...validWorkAnswers,
      work_q4: {
        optionIds: [
          'work_q4_repetitive',
          'work_q4_social',
          'work_q4_isolated',
          'work_q4_controlled',
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ['missing required answer', { ...validWorkAnswers, work_q1: undefined }],
    ['unknown question', { ...validWorkAnswers, injected: { optionIds: ['x'] } }],
    ['unknown option', { ...validWorkAnswers, work_q1: { optionIds: ['unknown'] } }],
    ['wrong single-select shape', { ...validWorkAnswers, work_q1: { optionIds: [] } }],
  ])('rejects %s', (_label, answers) => {
    expect(validateDirectionAnswers('work', answers).success).toBe(false);
  });

  it('normalizes and bounds city candidates', () => {
    const result = validateDirectionAnswers('city', {
      city_q1: { optionIds: ['city_q1_hangzhou'] },
      city_q2: {
        optionIds: ['city_q2_domestic'],
        supplementaryValue: [' 上海 ', '成都', '上海'],
      },
      city_q3: { optionIds: ['city_q3_jobs'] },
      city_q4: { optionIds: ['city_q4_specialize'] },
      city_q5: { optionIds: ['city_q5_partner'] },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.city_q2.supplementaryValue).toEqual(['上海', '成都']);
    }
  });

  it('rejects another-city selection without a custom city name', () => {
    const result = validateDirectionAnswers('city', {
      city_q1: { optionIds: ['city_q1_other'] },
      city_q2: { optionIds: ['city_q2_domestic'] },
      city_q3: { optionIds: ['city_q3_jobs'] },
      city_q4: { optionIds: ['city_q4_specialize'] },
      city_q5: { optionIds: ['city_q5_partner'] },
    });

    expect(result.success).toBe(false);
  });

  it('normalizes the custom city name for another-city selection', () => {
    const result = validateDirectionAnswers('city', {
      city_q1: { optionIds: ['city_q1_other'], supplementaryValue: [' 成都 '] },
      city_q2: { optionIds: ['city_q2_domestic'] },
      city_q3: { optionIds: ['city_q3_jobs'] },
      city_q4: { optionIds: ['city_q4_specialize'] },
      city_q5: { optionIds: ['city_q5_partner'] },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.city_q1.supplementaryValue).toEqual(['成都']);
    }
  });
});
