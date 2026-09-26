import { describe, expect, it } from 'vitest';

import { isDirectionComplete, validateDirectionAnswers } from './answers';

const workAnswersV1 = {
  work_q1: { optionIds: ['work_q1_employed_change'] },
  work_q2: { optionIds: ['work_q2_content', 'work_q2_design'] },
  work_q3: { optionIds: ['work_q3_ideas'] },
  work_q4: { optionIds: ['work_q4_repetitive', 'work_q4_controlled'] },
  work_q5: { optionIds: ['work_q5_growth', 'work_q5_balance'] },
};

const workAnswersV2 = {
  work_q1: { optionIds: ['work_q1_employed_change'] },
  work_experience: { optionIds: ['work_experience_capable_drained'] },
  work_q3: { optionIds: ['work_q3_ideas'] },
  work_q4: { optionIds: ['work_q4_repetitive', 'work_q4_controlled'] },
  work_q5: { optionIds: ['work_q5_growth', 'work_q5_balance'] },
};

describe('validateDirectionAnswers', () => {
  it('accepts a complete answer set for the current questionnaire', () => {
    expect(validateDirectionAnswers('work', workAnswersV2).success).toBe(true);
    expect(isDirectionComplete('work', workAnswersV2)).toBe(true);
  });

  it('still accepts answers captured on the previous questionnaire', () => {
    expect(validateDirectionAnswers('work', workAnswersV1, 'v1').success).toBe(true);
    expect(isDirectionComplete('work', workAnswersV1, 'v1')).toBe(true);
  });

  it('rejects answers that do not belong to the version being validated', () => {
    expect(validateDirectionAnswers('work', workAnswersV2, 'v1').success).toBe(false);
    expect(validateDirectionAnswers('work', workAnswersV1, 'v2').success).toBe(false);
  });

  it('rejects an incomplete answer set', () => {
    const incomplete: Record<string, unknown> = { ...workAnswersV2 };
    delete incomplete.work_experience;

    expect(validateDirectionAnswers('work', incomplete).success).toBe(false);
  });

  it('rejects more than the configured multi-select limit', () => {
    const result = validateDirectionAnswers('work', {
      ...workAnswersV2,
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
    ['missing required answer', { ...workAnswersV2, work_q1: undefined }],
    ['unknown question', { ...workAnswersV2, injected: { optionIds: ['x'] } }],
    ['unknown option', { ...workAnswersV2, work_q1: { optionIds: ['unknown'] } }],
    ['wrong single-select shape', { ...workAnswersV2, work_q1: { optionIds: [] } }],
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
