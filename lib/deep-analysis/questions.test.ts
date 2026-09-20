import { describe, expect, it } from 'vitest';

import { DIRECTIONS, QUESTIONNAIRE_VERSION, QUESTION_BANK_V1 } from './questions';

describe('V1 deep-analysis question bank', () => {
  it.each(['work', 'industry', 'city', 'collaboration'] as const)(
    '%s has exactly five stable questions',
    (id) => {
      expect(QUESTION_BANK_V1[id]).toHaveLength(5);
      expect(new Set(QUESTION_BANK_V1[id].map((question) => question.id)).size).toBe(5);
      expect(QUESTION_BANK_V1[id].every((question) => question.directionId === id)).toBe(true);
    },
  );

  it('uses stable direction metadata and questionnaire version', () => {
    expect(QUESTIONNAIRE_VERSION).toBe('v1');
    expect(DIRECTIONS.map((direction) => direction.id)).toEqual([
      'work',
      'industry',
      'city',
      'collaboration',
      'custom',
    ]);
  });

  it('keeps the city candidate supplementary field bounded to five items', () => {
    expect(QUESTION_BANK_V1.city[1].supplementaryField).toEqual(
      expect.objectContaining({ id: 'city_q2_candidates', maxItems: 5, required: false }),
    );
  });

  it('has globally unique question and option IDs', () => {
    const questions = Object.values(QUESTION_BANK_V1).flat();
    const questionIds = questions.map((question) => question.id);
    const optionIds = questions.flatMap((question) => question.options?.map((option) => option.id) ?? []);

    expect(new Set(questionIds).size).toBe(questionIds.length);
    expect(new Set(optionIds).size).toBe(optionIds.length);
  });
});
