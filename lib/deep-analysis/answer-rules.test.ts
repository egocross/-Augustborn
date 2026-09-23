import { describe, expect, it } from 'vitest';

import { parseSupplementaryValues, toggleOptionId } from './answer-rules';

describe('option toggling', () => {
  it('enforces the multi-select limit without changing the answer', () => {
    const result = toggleOptionId(
      ['work_q4_repetitive', 'work_q4_social', 'work_q4_isolated'],
      'work_q4_controlled',
      { maxSelect: 3 },
    );

    expect(result).toEqual({ kind: 'reject', message: '最多选择 3 项' });
  });

  it('replaces every other choice when the placeholder is selected', () => {
    const result = toggleOptionId(['city_q5_parents', 'city_q5_children'], 'city_q5_none');

    expect(result).toEqual({ kind: 'replace', optionIds: ['city_q5_none'] });
  });

  it('drops the placeholder as soon as a concrete choice is selected', () => {
    const result = toggleOptionId(['work_q4_none'], 'work_q4_travel', { maxSelect: 3 });

    expect(result).toEqual({ kind: 'replace', optionIds: ['work_q4_travel'] });
  });

  it('does not count the placeholder against the selection limit', () => {
    const result = toggleOptionId(['city_q5_none', 'city_q5_partner', 'city_q5_children'], 'city_q5_property');

    expect(result).toEqual({ kind: 'replace', optionIds: ['city_q5_partner', 'city_q5_children', 'city_q5_property'] });
  });

  it('unselects an already selected option', () => {
    expect(toggleOptionId(['work_q4_travel'], 'work_q4_travel')).toEqual({ kind: 'replace', optionIds: [] });
  });
});

describe('supplementary values', () => {
  it('splits Chinese and English separators', () => {
    expect(parseSupplementaryValues('上海、成都, 杭州/苏州')).toEqual(['上海', '成都', '杭州', '苏州']);
  });

  it('drops duplicates and applies the item limit', () => {
    expect(parseSupplementaryValues('上海、成都、上海', 2)).toEqual(['上海', '成都']);
  });
});
