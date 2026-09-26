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

it('grounds the report request in the supplied chart and safety boundaries', () => {
  const prompt = createReportPrompt(chart);

  expect(prompt).toContain('1990-01-01');
  expect(prompt).toContain('行业');
  expect(prompt).toContain('不要迎合');
  expect(prompt).toContain('医疗');
  expect(prompt).toContain('投资');
});

it('requires the report to be written in Simplified Chinese', () => {
  expect(createReportPrompt(chart)).toContain('简体中文');
});

it('keeps the product request line verbatim', () => {
  expect(createReportPrompt(chart)).toContain(
    '人生是一系列决策，需要在正确的地方选择正确的行业，从事什么工作、与谁一起共事都非常重要，结合我的八字，为我指明方向或者提供建议？（注意⚠️不要迎合我，不看过往记录，客观分析）',
  );
});

it('carries the consultant role and the non-flattering objective', () => {
  const prompt = createReportPrompt(chart);

  expect(prompt).toContain('人生规划顾问');
  expect(prompt).toContain('迷信');
  expect(prompt).toContain('宿命论');
  expect(prompt).toContain('绝对客观与冷酷');
  expect(prompt).toContain('现代语境映射');
  expect(prompt).toContain('闭环思维');
});

it('guides the model through the requested decision-report narrative', () => {
  const prompt = createReportPrompt(chart);

  const narrativeStages = [
    '核心性格与底层矛盾',
    '在什么地方？（方位与环境）',
    '从事什么行业？（方向选择）',
    '怎么工作？与谁共事？',
    '给你的客观建议',
  ];

  expect(narrativeStages.every((stage) => prompt.includes(stage))).toBe(true);
  expect(narrativeStages.map((stage) => prompt.indexOf(stage))).toEqual(
    [...narrativeStages.map((stage) => prompt.indexOf(stage))].sort((a, b) => a - b),
  );

  for (const label of [
    '日主能量',
    '盘面最大特征',
    '用神方位',
    '城市属性建议',
    '格局转化',
    '五行行业标签',
    '交集点',
    '组织形态',
    '搭档选择',
  ]) {
    expect(prompt).toContain(label);
  }
});

it('requires chart-grounded JSON output with the fixed disclaimer', () => {
  const prompt = createReportPrompt(chart);

  expect(prompt).toContain('排盘以输入的 pillars 为准');
  expect(prompt).toContain('fiveElements 只是表层干支计数');
  expect(prompt).toContain('只返回一个 JSON 对象');
  expect(prompt).toContain('sections 和 disclaimer');
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
  expect(prompt).toContain('不输出任何依赖出生时辰的判断');
  expect(prompt).toContain('只作为环境背景使用');
  expect(prompt).toContain('浙江杭州');
});

it('keeps the traditional terminology the product now asks for', () => {
  const prompt = createReportPrompt(chart);

  expect(prompt).toContain('十神');
  expect(prompt).toContain('用神');
  expect(prompt).toContain('冲合刑害');
  expect(prompt).toContain('每处关键术语后要跟一句人话解释');
});
