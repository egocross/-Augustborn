import { describe, expect, it } from 'vitest';

import { createDeepPrompt } from './index';

const payload = {
  birthProfile: { timeKnown: true, pillars: { day: '乙卯' } },
  freeReportSummary: { sections: [{ heading: '性格', summary: '冷静', bullets: [] }] },
  questionnaireVersion: 'v2' as const,
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

  it('carries question meaning with work answers instead of making the model infer option IDs', () => {
    const prompt = createDeepPrompt({ ...payload, directionId: 'work', answers: { work_q4: { optionIds: ['work_q4_travel'] } } });
    expect(prompt).toContain('你最不希望长期处于哪种工作状态？');
    expect(prompt).toContain('"answers":["经常出差"]');
    expect(prompt).not.toContain('work_q4_travel');
  });

  it('describes past experience as an evaluation of how it felt, not a role list', () => {
    const prompt = createDeepPrompt({ ...payload, directionId: 'work', answers: { work_experience: { optionIds: ['work_experience_capable_drained'] } } });
    expect(prompt).toContain('回看做过的工作或学习任务，你更接近哪种感受？');
    expect(prompt).toContain('做得来，但长期很消耗');
    expect(prompt).not.toContain('work_experience_capable_drained');
  });

  it('still describes answers captured on the previous questionnaire', () => {
    const prompt = createDeepPrompt({
      ...payload, questionnaireVersion: 'v1', directionId: 'work',
      answers: { work_q2: { optionIds: ['work_q2_content'] } },
    });
    expect(prompt).toContain('过去你主要做过哪些类型的事情？');
    expect(prompt).toContain('内容创作');
  });

  it('tells the model that past roles do not prove a direction fits', () => {
    const prompt = createDeepPrompt({ ...payload, directionId: 'work' });
    expect(prompt).toContain('不能证明这个方向适合长期做');
    expect(prompt).toContain('现在容易进入');
  });
});
