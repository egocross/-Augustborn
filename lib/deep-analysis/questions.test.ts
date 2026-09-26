import { describe, expect, it } from 'vitest';

import { DIRECTIONS, getFixedQuestions, QUESTION_BANK_V1, QUESTION_BANK_V2, QUESTIONNAIRE_VERSION } from './questions';

const VERSIONS = [QUESTION_BANK_V1, QUESTION_BANK_V2] as const;

describe('deep-analysis question bank', () => {
  it.each(['work', 'industry', 'city', 'collaboration'] as const)(
    '%s keeps five stable questions in every version',
    (id) => {
      for (const bank of VERSIONS) {
        expect(bank[id]).toHaveLength(5);
        expect(new Set(bank[id].map((question) => question.id)).size).toBe(5);
        expect(bank[id].every((question) => question.directionId === id)).toBe(true);
      }
    },
  );

  it('serves the current version by default and the older one on request', () => {
    expect(QUESTIONNAIRE_VERSION).toBe('v2');
    expect(getFixedQuestions('work')).toBe(QUESTION_BANK_V2.work);
    expect(getFixedQuestions('work', 'v1')).toBe(QUESTION_BANK_V1.work);
    expect(DIRECTIONS.map((direction) => direction.id)).toEqual([
      'work',
      'industry',
      'city',
      'collaboration',
      'custom',
    ]);
  });

  it('asks how past experience felt instead of listing what the reader used to do', () => {
    const ids = QUESTION_BANK_V2.work.map((question) => question.id);
    expect(ids).toContain('work_experience');
    expect(ids).not.toContain('work_q2');

    const experience = QUESTION_BANK_V2.work[1];
    expect(experience.text).toBe('回看做过的工作或学习任务，你更接近哪种感受？');
    expect(experience.description).toBeTruthy();
    expect(experience.options?.map((option) => option.label)).toEqual([
      '有想继续做的事情',
      '做得来，但长期很消耗',
      '有些愿意继续，有些想摆脱',
      '大多不适合，想尝试新方向',
      '经历较少，还没找到感觉',
      '暂时说不清',
    ]);
  });

  it('introduces brand new option IDs for the replacement question', () => {
    const legacy = new Set(Object.values(QUESTION_BANK_V1).flat().flatMap((question) => question.options?.map((option) => option.id) ?? []));
    const added = QUESTION_BANK_V2.work.flatMap((question) => question.options?.map((option) => option.id) ?? []).filter((id) => !legacy.has(id));

    expect(added).toEqual([
      'work_experience_retain',
      'work_experience_capable_drained',
      'work_experience_mixed',
      'work_experience_change',
      'work_experience_limited',
      'work_experience_uncertain',
    ]);
  });

  it('keeps the city candidate supplementary field bounded to five items', () => {
    for (const bank of VERSIONS) {
      expect(bank.city[1].supplementaryField).toEqual(
        expect.objectContaining({ id: 'city_q2_candidates', maxItems: 5, required: false }),
      );
    }
  });

  it('has globally unique question and option IDs inside each version', () => {
    for (const bank of VERSIONS) {
      const questions = Object.values(bank).flat();
      const questionIds = questions.map((question) => question.id);
      const optionIds = questions.flatMap((question) => question.options?.map((option) => option.id) ?? []);

      expect(new Set(questionIds).size).toBe(questionIds.length);
      expect(new Set(optionIds).size).toBe(optionIds.length);
    }
  });
});
