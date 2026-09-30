import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { createSampleCareerReport } from '@/lib/report-provider/sample';
import { CareerReportView } from './career-report-view';

afterEach(cleanup);

const report = createSampleCareerReport({
  questionnaireVersion: 'career-v1',
  baseReport: { disclaimer: '仅供参考', sections: [{ heading: '方向', body: '内容', bullets: [] }] },
  careerCalibration: {
    questionnaireVersion: 'career-v1',
    hardConstraints: {
      careerStatus: 'career_status_first_job', transitionUrgency: 'transition_3_months',
      income: { minimumIncomeBand: 'minimum_income_3000_5000', currency: 'CNY', salaryDropTolerance: 'salary_drop_none' },
      responsibilities: ['responsibility_none'], location: { mobility: 'mobility_nationwide', constraints: [] },
      transitionCapacity: { weeklyHours: 'weekly_hours_full_time', preparationHorizon: 'preparation_3_6_months', maxBudget: 'budget_none' },
      restartTolerance: 'restart_entry_level', educationTolerance: 'education_short', workConstraints: ['work_constraint_none'],
      incomeModels: ['income_model_any'], employmentTypes: ['employment_type_any'],
    },
    careerCapital: { experience: [], skills: ['capital_content'], evidence: [] }, values: ['value_growth'],
  },
});

it('puts career validation before generic boundaries and keeps each career scan-friendly', () => {
  render(<CareerReportView report={report} />);
  const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
  expect(headings.indexOf('当前值得优先验证的职业方向')).toBeLessThan(headings.indexOf('你的现实职业边界'));
  expect(headings.indexOf('你的现实职业边界')).toBeLessThan(headings.indexOf('你的可迁移职业资本'));
  expect(screen.getAllByTestId('career-hypothesis')).toHaveLength(3);
  expect(screen.getAllByText('市场可行性待验证')).toHaveLength(3);
  expect(screen.queryByText('未来 30 天验证计划')).toBeNull();
  expect(document.body.textContent).not.toMatch(/唯一方向|你必须辞职/);
});

it('orders the decision summary as real work, biggest gap, then the first validation action', () => {
  render(<CareerReportView report={report} />);
  const first = screen.getAllByTestId('career-hypothesis')[0];
  const text = first.textContent ?? '';

  expect(text.indexOf('真实核心工作')).toBeLessThan(text.indexOf('最大入场缺口'));
  expect(text.indexOf('最大入场缺口')).toBeLessThan(text.indexOf('先做这个验证'));
  expect(first.querySelector('details')).toBeTruthy();
  expect(first.querySelector('summary')?.textContent).toContain('查看完整工作验证');
});

it('makes hard barriers, bridge paths, and action outputs explicit', () => {
  render(<CareerReportView report={report} />);

  expect(screen.getByText('短期无法补齐的门槛')).toBeTruthy();
  expect(screen.getByText('真实业务或研究项目经历')).toBeTruthy();
  expect(screen.getByText('替代进入路径')).toBeTruthy();
  expect(screen.getAllByText('验证什么').length).toBeGreaterThanOrEqual(2);
  expect(screen.getAllByText('时间 / 成本').length).toBeGreaterThanOrEqual(2);
  expect(screen.getAllByText('最终得到什么').length).toBeGreaterThanOrEqual(2);
  expect(screen.getAllByText(/示例模式未查询公开岗位/).length).toBeGreaterThanOrEqual(1);
});

it('shows source count and links only when verified sources exist', () => {
  const sourced = structuredClone(report);
  sourced.marketStatus = 'partial';
  sourced.careerHypotheses[0].evidenceStatus = 'partial';
  sourced.careerHypotheses[0].sourceCount = 1;
  sourced.careerHypotheses[0].sources = [{
    title: '招聘详情', site: '猎聘', url: 'https://www.liepin.com/job/123.shtml', excerpt: '职位详情',
  }];
  render(<CareerReportView report={sourced} />);
  expect(screen.getByText('部分来源支持 · 1 条')).toBeTruthy();
  expect(screen.getByRole('link', { name: /招聘详情/ }).getAttribute('href')).toBe('https://www.liepin.com/job/123.shtml');
});

it('offers the validator only for hypotheses that have a matching access item', () => {
  const access = [
    { careerId: 'career-1-aaa', validationSessionId: '123e4567-e89b-42d3-a456-426614174001', capability: 'cap-1' },
    { careerId: 'career-2-bbb', validationSessionId: '123e4567-e89b-42d3-a456-426614174002', capability: 'cap-2' },
    { careerId: 'career-3-ccc', validationSessionId: '123e4567-e89b-42d3-a456-426614174003', capability: 'cap-3' },
  ];
  const { unmount } = render(<CareerReportView report={report} validationAccess={access} />);
  const links = screen.getAllByRole('link', { name: /开始真实任务验证/ });
  expect(links).toHaveLength(3);
  expect(links.map((link) => link.getAttribute('href'))).toEqual(access.map((item) => `/career-validation/${item.validationSessionId}`));
  expect(links[0].getAttribute('href')).not.toContain(access[0].capability);
  unmount();

  const withoutSecondValidation = structuredClone(report);
  delete (withoutSecondValidation.careerHypotheses[1] as { workValidation?: unknown }).workValidation;
  render(<CareerReportView report={withoutSecondValidation} validationAccess={access} />);
  const partialLinks = screen.getAllByRole('link', { name: /开始真实任务验证/ });
  expect(partialLinks).toHaveLength(2);
  expect(partialLinks[1].getAttribute('href')).toBe('/career-validation/123e4567-e89b-42d3-a456-426614174002');
});

it('renders no validator entry point without server access', () => {
  render(<CareerReportView report={report} />);
  expect(screen.queryByRole('link', { name: /开始真实任务验证/ })).toBeNull();
});
