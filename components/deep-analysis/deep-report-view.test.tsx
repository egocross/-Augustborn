import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { DeepReportView } from './deep-report-view';
import type { JobResearch } from '@/lib/deep-analysis/research/schema';
import { DeepReportSchema } from '@/lib/deep-analysis/types';
import { createSampleDeepReport } from '@/lib/report-provider/sample';

afterEach(cleanup);

it.each([
  ['industry', '先拓宽你的行业选择'],
  ['city', '按你的条件，分三步看城市'],
  ['collaboration', '哪些能力能与你形成互补？'],
] as const)('renders the %s exploration structure from a persisted report', (directionId, heading) => {
  const parsed = DeepReportSchema.parse(createSampleDeepReport({ directionId, optionalContext: '' }));
  const { container } = render(<DeepReportView report={parsed} />);
  expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
  if (directionId === 'city') expect(container.querySelectorAll('.city-tier')).toHaveLength(3);
  if (directionId === 'collaboration') {
    expect(screen.getAllByText('你负责').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('对方负责').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('先试一次合作').length).toBeGreaterThanOrEqual(2);
  }
});

const workDirections = {
  groups: [
    { title: '把想法变成内容', tags: ['内容策划', '文案策划', '新媒体编辑', '视频策划'], rationale: '表达偏好需要用作品验证。', boundary: '先核对修改频率与交付节奏。' },
    { title: '把信息变成判断', tags: ['用户研究', '市场研究', '数据分析', '竞品分析'], rationale: '独立分析是值得验证的线索。', boundary: '分析工具熟练度尚不明确。' },
  ],
  intersection: '尝试把用户研究结果转成内容选题，用一个小项目检验两类任务。',
};

const report = {
  title: '你的职业方向深度分析', summary: '先聚焦能长期复利的问题解决型工作。', keyFindings: ['优先专注', '避免高频切换'],
  cards: [
    { id: 'c1', title: '优先方向', summary: '选择能沉淀方法的角色', details: ['先验证日常任务'], evidence: ['你偏好独立分析'] },
    { id: 'c2', title: '排除条件', summary: '避免长期无反馈', details: ['核对团队节奏'], evidence: [] },
    { id: 'c3', title: '验证方法', summary: '用小项目测试', details: ['完成一次真实交付'], evidence: [] },
  ],
  risks: [{ title: '过度分析', detail: '可能延迟行动', mitigation: '设置决策截止时间' }],
  nextActions: [{ title: '列出候选', detail: '只保留三个方向', timeframe: '本周' }, { title: '做一次访谈', detail: '核对真实工作内容', timeframe: '两周内' }],
  reflectionQuestions: ['什么任务让你愿意持续投入？'], disclaimer: '用于自我探索，重大决策请结合现实信息。',
};

it('renders model-defined cards and lets the reader expand details', () => {
  render(<DeepReportView report={report} />);
  expect(screen.getByText(report.title)).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /展开阅读/ })).toHaveLength(3);
  fireEvent.click(screen.getAllByRole('button', { name: /展开阅读/ })[0]);
  expect(screen.getByText('先验证日常任务')).toBeTruthy();
});

it('puts the direction map after the conclusions and recruitment evidence right after the analysis', () => {
  const parsed = DeepReportSchema.parse({ ...report, workDirections, jobResearch: {
    status: 'unavailable', checkedAt: '2026-09-25T08:00:00.000Z', note: '未取得招聘证据。', recommendations: [],
  } });
  const { container } = render(<DeepReportView report={parsed} />);
  expect(screen.getByText('内容策划')).toBeTruthy();
  expect(screen.getByText('分析工具熟练度尚不明确。')).toBeTruthy();
  expect(screen.getByText(workDirections.intersection)).toBeTruthy();
  expect(container.querySelectorAll('.work-direction-tags li')).toHaveLength(8);
  const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
  expect(headings).toEqual([
    '先看结论', '可以进一步探索的工作方向', '优先方向', '排除条件', '验证方法',
    '可以从这些职位开始找', '需要特别注意', '当前唯一优先行动', '辅助行动', '建议你继续思考',
  ]);
  expect(screen.queryByRole('button', { name: '内容策划' })).toBeNull();
});

it('rejects malformed direction groups without breaking reports saved before this feature', () => {
  expect(DeepReportSchema.safeParse(report).success).toBe(true);
  expect(DeepReportSchema.safeParse({ ...report, workDirections: { ...workDirections, groups: [{ ...workDirections.groups[0], tags: [] }] } }).success).toBe(false);
});

it('shows source-linked jobs with expandable requirements and no third-party iframe', () => {
  const jobResearch: JobResearch = {
    status: 'limited', checkedAt: '2026-09-24T08:00:00.000Z', note: '本次只有一个可靠招聘来源。',
    recommendations: [{ title: '产品运营', searchKeywords: ['产品运营'], fitReason: '根据运营经历优先探索。', entryGap: '核对经验要求。', nextStep: '准备一个项目案例。',
      source: { title: '招聘页', site: '猎聘', url: 'https://www.liepin.com/job/123.shtml', excerpt: '产品运营负责活动策划。' } }],
    searchSuggestionsHtml: '<div>Search suggestions</div>',
  };
  const { container } = render(<DeepReportView report={{ ...report, jobResearch }} />);
  expect(screen.getByRole('heading', { name: '可以从这些职位开始找' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /在猎聘查看产品运营/ }).getAttribute('href')).toBe(jobResearch.recommendations[0].source.url);
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.querySelector('details summary')?.textContent).toBe('查看门槛与下一步');
});

it('renders the calibration, ranking, exclusion and validation modules', () => {
  const parsed = DeepReportSchema.parse({
    ...report,
    calibration: { constraints: ['更愿意处理复杂问题，而不是长期重复执行', '希望保留较高自主性'], narrowing: '方向因此收窄为知识型、可积累的岗位。' },
    directionRanking: [
      { priority: 'primary', title: '知识产品设计', whyKept: '命理线索与现实答案同时指向知识结构化与独立判断。', roleFit: ['课程结构设计'], taskFit: ['需求研究', '内容产品化'], notFit: ['纯销售'] },
      { priority: 'watch', title: '研究型内容策划', whyKept: '可作为观察方向。', roleFit: ['内容策划'], taskFit: ['深度研究'], notFit: ['追热点'] },
    ],
    excludedDirections: [{ title: '纯销售', reason: '需要持续高频陌生沟通，与现实约束不匹配。', basis: 'both' }],
    workSplit: { youOwn: ['研究', '结构设计'], partnerOwns: ['销售', '商务'] },
    validationPlan: { task: '做一个最小知识产品测试', weeks: [{ label: '第1周', detail: '选一个具体问题。' }, { label: '第2周', detail: '做成最小交付物。' }], successCriteria: ['至少 5 人真实体验'], fallbackNote: '验证失败不等于方向不适合。' },
    nextAction: { title: '确定一个具体问题', detail: '写下你要解决的第一个问题。', timeframe: '明天' },
  });
  render(<DeepReportView report={parsed} />);
  expect(screen.getByRole('heading', { name: '本次校准发生了什么' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: '这次筛选后的最终排序' })).toBeTruthy();
  expect(screen.getByText('第一优先方向')).toBeTruthy();
  expect(screen.getByRole('heading', { name: '这次被降低或排除的方向' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: '最适合你的工作组合' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: '未来 30 天唯一验证任务' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: '当前唯一优先行动' })).toBeTruthy();
  expect(screen.queryByText('可以进一步探索的工作方向')).toBeNull();
});
