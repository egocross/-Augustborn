import { expect, it } from 'vitest';

import { createReportPrompt } from './prompt';

it('grounds the report request in the supplied chart and safety boundaries', () => {
  const prompt = createReportPrompt({
    solarDate: '1990-01-01',
    pillars: { year: '庚午', month: '戊子', day: '甲子', hour: '甲子' },
    hourBranch: '子',
    fiveElements: { 木: 2, 火: 1, 土: 2, 金: 1, 水: 2 },
  });

  expect(prompt).toContain('1990-01-01');
  expect(prompt).toContain('行业');
  expect(prompt).toContain('不要迎合');
  expect(prompt).toContain('医疗');
  expect(prompt).toContain('投资');
});

it('requires the report to be written in Simplified Chinese', () => {
  const prompt = createReportPrompt({
    solarDate: '1990-01-01',
    pillars: { year: '庚午', month: '戊子', day: '甲子', hour: '甲子' },
    hourBranch: '子',
    fiveElements: { 木: 2, 火: 1, 土: 2, 金: 1, 水: 2 },
  });

  expect(prompt).toContain('简体中文');
});
