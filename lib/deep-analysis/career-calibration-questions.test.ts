import { describe, expect, it } from 'vitest';

import {
  CAREER_QUESTIONS,
  CAREER_QUESTIONNAIRE_VERSION,
  CAREER_SECTIONS,
  getVisibleCareerQuestions,
  pruneHiddenCareerAnswers,
} from './career-calibration-questions';

describe('career calibration question bank', () => {
  it('defines the approved eight-stage career questionnaire', () => {
    expect(CAREER_QUESTIONNAIRE_VERSION).toBe('career-v1');
    expect(CAREER_SECTIONS.map((section) => section.title)).toEqual([
      '当前状态',
      '收入与现金流',
      '现实责任',
      '地点边界',
      '转型投入',
      '职业资本',
      '工作边界',
      '当前优先级',
    ]);

    const labels = CAREER_QUESTIONS.flatMap((question) => question.options?.map((option) => option.label) ?? []);
    expect(labels).toEqual(expect.arrayContaining([
      '第一次正式求职',
      '完全不能接受',
      '暂时没有明显家庭责任',
      '必须留在当前城市',
      '可以全职投入',
      '目前几乎没有明显可迁移职业资本',
      '长期加班',
      '可以积累个人资产',
    ]));
  });

  it('uses globally unique question and option IDs with bounded other fields', () => {
    const questionIds = CAREER_QUESTIONS.map((question) => question.id);
    const optionIds = CAREER_QUESTIONS.flatMap((question) => question.options?.map((option) => option.id) ?? []);

    expect(new Set(questionIds).size).toBe(questionIds.length);
    expect(new Set(optionIds).size).toBe(optionIds.length);
    for (const question of CAREER_QUESTIONS.filter((item) => item.other)) {
      expect(question.other?.maxLength).toBeLessThanOrEqual(200);
      expect(question.options?.some((option) => option.id === question.other?.optionId)).toBe(true);
    }
  });

  it('limits the final value question to three selections', () => {
    const values = CAREER_QUESTIONS.find((question) => question.id === 'career_values');

    expect(values).toMatchObject({ type: 'multi', maxSelections: 3 });
  });
});

describe('career questionnaire branching', () => {
  it('shows salary runway only when the user accepts a temporary income drop', () => {
    expect(getVisibleCareerQuestions({}).some((question) => question.id === 'income_runway')).toBe(false);
    expect(getVisibleCareerQuestions({
      salary_drop_tolerance: { optionIds: ['salary_drop_20'] },
    }).some((question) => question.id === 'income_runway')).toBe(true);
    expect(getVisibleCareerQuestions({
      salary_drop_tolerance: { optionIds: ['salary_drop_none'] },
    }).some((question) => question.id === 'income_runway')).toBe(false);
  });

  it('shows mobility reasons only for fixed or limited movement', () => {
    for (const optionId of ['mobility_fixed', 'mobility_nearby', 'mobility_same_province']) {
      expect(getVisibleCareerQuestions({
        location_mobility: { optionIds: [optionId] },
      }).some((question) => question.id === 'location_constraints')).toBe(true);
    }

    expect(getVisibleCareerQuestions({
      location_mobility: { optionIds: ['mobility_nationwide'] },
    }).some((question) => question.id === 'location_constraints')).toBe(false);
  });

  it('shows work languages only when overseas is explicitly selected', () => {
    expect(getVisibleCareerQuestions({
      location_mobility: { optionIds: ['mobility_overseas'] },
    }).some((question) => question.id === 'work_languages')).toBe(true);
    expect(getVisibleCareerQuestions({
      location_mobility: { optionIds: ['mobility_remote'] },
    }).some((question) => question.id === 'work_languages')).toBe(false);
  });

  it('prunes stale answers after a controlling answer changes', () => {
    const pruned = pruneHiddenCareerAnswers({
      salary_drop_tolerance: { optionIds: ['salary_drop_none'] },
      income_runway: { optionIds: ['runway_6_12_months'] },
      location_mobility: { optionIds: ['mobility_nationwide'] },
      location_constraints: { optionIds: ['location_constraint_family'] },
      work_languages: { optionIds: ['language_english'] },
    });

    expect(pruned).toEqual({
      salary_drop_tolerance: { optionIds: ['salary_drop_none'] },
      location_mobility: { optionIds: ['mobility_nationwide'] },
    });
  });
});
