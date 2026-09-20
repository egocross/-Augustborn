import { describe, expect, it } from 'vitest';

import { createDeepPrompt } from './index';

const payload = {
  birthProfile: { timeKnown: true, pillars: { day: '乙卯' } },
  freeReportSummary: { sections: [{ heading: '性格', summary: '冷静', bullets: [] }] },
  questionnaireVersion: 'v1' as const,
  answers: { work_q1: { optionIds: ['work_q1_student'] } },
  optionalContext: '',
  customQuestion: null,
  cityContext: null,
};

describe('createDeepPrompt', () => {
  it.each(['work', 'industry', 'city', 'collaboration', 'custom'] as const)(
    'builds a distinct %s prompt',
    (directionId) => {
      const prompt = createDeepPrompt({ ...payload, directionId });
      expect(prompt).toContain('探索式');
      expect(prompt).toContain(`direction=${directionId}`);
      expect(prompt).toContain('只返回符合 Schema 的简体中文 JSON');
    },
  );

  it('keeps custom analysis centered on the supplied question', () => {
    const prompt = createDeepPrompt({ ...payload, directionId: 'custom', customQuestion: '我要不要转岗？' });
    expect(prompt).toContain('我要不要转岗？');
    expect(prompt).toContain('不要强行归入四个标准方向');
  });
});
