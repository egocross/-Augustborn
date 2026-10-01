import { describe, expect, it } from 'vitest';

import { careerCapitalLabel, localizeCareerCapital } from './career-capital-labels';
import { CAREER_QUESTIONS } from './career-calibration-questions';

describe('career capital labels', () => {
  it('maps every questionnaire capital option to a Chinese label', () => {
    const capitalQuestion = CAREER_QUESTIONS.find((question) => question.id === 'career_capital');
    expect(capitalQuestion).toBeTruthy();
    for (const option of capitalQuestion?.options ?? []) {
      const label = careerCapitalLabel(option.id);
      expect(label).not.toBe(option.id);
      expect(label).not.toMatch(/^capital_/);
      expect(label).toBe(option.label);
    }
  });

  it('never leaks a stored option id, even for unknown or legacy ids', () => {
    expect(careerCapitalLabel('capital_programming')).toBe('技术 / 编程');
    expect(careerCapitalLabel('capital_unknown_legacy')).not.toContain('capital_');
  });

  it('localizes all three capital groups without reordering them', () => {
    const localized = localizeCareerCapital({
      experience: ['capital_operations'], skills: ['capital_content', 'capital_data'], evidence: ['capital_portfolio'],
    });
    expect(localized).toEqual({
      experience: ['运营'], skills: ['内容创作', '数据分析'], evidence: ['有作品集'],
    });
  });
});
