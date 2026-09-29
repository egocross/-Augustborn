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

it('renders the career report in decision order with explicit evidence states', () => {
  render(<CareerReportView report={report} />);
  const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
  expect(headings.indexOf('你的现实职业边界')).toBeLessThan(headings.indexOf('你的可迁移职业资本'));
  expect(headings.indexOf('你的可迁移职业资本')).toBeLessThan(headings.indexOf('当前值得优先验证的职业方向'));
  expect(screen.getAllByTestId('career-hypothesis')).toHaveLength(3);
  expect(screen.getAllByText('市场可行性待验证')).toHaveLength(3);
  expect(screen.getByText('未来 30 天验证计划')).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/唯一方向|你必须辞职/);
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
