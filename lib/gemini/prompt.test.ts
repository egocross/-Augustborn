import { expect, it } from 'vitest';

import { createReportPrompt } from './prompt';

const chart = {
  solarDate: '1990-01-01',
  birthRegion: null,
  timeKnown: true,
  pillars: { year: '庚午', month: '戊子', day: '甲子', hour: '甲子' },
  hourBranch: '子',
  fiveElements: { 木: 2, 火: 1, 土: 2, 金: 1, 水: 2 },
};

it('grounds the report request in the supplied chart', () => {
  const prompt = createReportPrompt(chart);

  expect(prompt).toContain('1990-01-01');
  expect(prompt).toContain('不要迎合');
  expect(prompt).toContain('医疗');
});

it('requires Simplified Chinese JSON output', () => {
  expect(createReportPrompt(chart)).toContain('简体中文');
});

it('keeps the product request line verbatim', () => {
  expect(createReportPrompt(chart)).toContain(
    '人生是一系列决策，需要在正确的地方选择正确的行业，从事什么工作、与谁一起共事都非常重要，结合我的八字，为我指明方向或者提供建议？（注意⚠️不要迎合我，不看过往记录，客观分析）',
  );
});

it('carries the advisor role and its no-flattery principles', () => {
  const prompt = createReportPrompt(chart);

  expect(prompt).toContain('八字结构');
  expect(prompt).toContain('第一原则：不要迎合');
  expect(prompt).toContain('先排结构，再下结论');
  expect(prompt).toContain('结论必须有方向性');
  expect(prompt).toContain('禁止伪造排盘');
});

it('guides the model through the seven-section decision framework in order', () => {
  const prompt = createReportPrompt(chart);

  const stages = [
    '核心格局：你人生最主要的矛盾',
    '地利：什么环境更适合你',
    '行业：在哪里创造价值',
    '工作方式：怎么工作比做什么更重要',
    '人和：和谁一起做事',
    '最大风险：这个命局最容易犯什么错误',
    '底层决策建议',
  ];

  expect(stages.every((stage) => prompt.includes(stage))).toBe(true);
  expect(stages.map((stage) => prompt.indexOf(stage))).toEqual(
    [...stages.map((stage) => prompt.indexOf(stage))].sort((a, b) => a - b),
  );
});

it('requires chart-grounded JSON output with the fixed disclaimer', () => {
  const prompt = createReportPrompt(chart);

  expect(prompt).toContain('只返回一个 JSON 对象');
  expect(prompt).toContain('sections');
  expect(prompt).toContain('disclaimer');
  expect(prompt).toContain('pillars 为年月日时四柱');
  expect(prompt).toContain('timeKnown 为 false');
  expect(prompt).toContain('仅供自我探索参考，不构成医疗、法律、财务或职业决策建议。');
});

it('bounds how an unknown birth time and a birth region may be used', () => {
  const prompt = createReportPrompt({
    ...chart,
    birthRegion: '浙江杭州',
    timeKnown: false,
    hourBranch: null,
    pillars: { ...chart.pillars, hour: null },
  });

  expect(prompt).toContain('timeKnown 为 false');
  expect(prompt).toContain('时柱未知');
  expect(prompt).toContain('浙江杭州');
});

it('keeps the traditional terminology the product now asks for', () => {
  const prompt = createReportPrompt(chart);

  expect(prompt).toContain('冲、合、刑、害');
  expect(prompt).toContain('日主');
  expect(prompt).toContain('十神');
  expect(prompt).toContain('财印冲突');
});
