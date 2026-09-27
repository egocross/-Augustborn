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

it('carries the independent thinking partner role and the no-flattery objective', () => {
  const prompt = createReportPrompt(chart);

  expect(prompt).toContain('独立思考伙伴');
  expect(prompt).toContain('拒绝情绪迎合');
  expect(prompt).toContain('宿命论');
  expect(prompt).toContain('抓取核心变量');
  expect(prompt).toContain('逻辑翻译与映射');
  expect(prompt).toContain('输出可执行动作');
});

it('guides the model through the requested decision-report narrative', () => {
  const prompt = createReportPrompt(chart);

  const narrativeStages = [
    '核心格局',
    '地利（去哪里）',
    '天时（从事什么行业与工作）',
    '人和（与谁共事、找什么合伙人）',
    '给你的底层决策建议',
  ];

  expect(narrativeStages.every((stage) => prompt.includes(stage))).toBe(true);
  expect(narrativeStages.map((stage) => prompt.indexOf(stage))).toEqual(
    [...narrativeStages.map((stage) => prompt.indexOf(stage))].sort((a, b) => a - b),
  );

  for (const label of [
    '不破不立',
    '喜忌',
    '核心竞争力',
    '互补',
    '48 小时冷却期',
    '专业壁垒',
    '大后期发力',
    '总结：',
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

  expect(prompt).toContain('冲合刑害');
  expect(prompt).toContain('喜用');
  expect(prompt).toContain('人话解释');
});
