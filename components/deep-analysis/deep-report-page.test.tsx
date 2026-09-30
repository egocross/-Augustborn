import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { createInitialDeepState, saveDeepSession } from '@/lib/deep-analysis/session';
import { createSampleCareerReport } from '@/lib/report-provider/sample';
import { DeepReportPage } from './deep-report-page';

const context = {
  freeReport: { disclaimer: '仅供参考', sections: [{ heading: '核心性格', body: '内容', bullets: [] }] },
  baseReportSnapshotToken: 'v1.digest.signature',
};

const report = {
  title: '你的职业方向深度分析',
  summary: '先用低成本实验验证方向。',
  keyFindings: ['优先专注', '核对现实约束'],
  cards: [
    { id: 'c1', title: '优先方向', summary: '从真实任务出发', details: ['完成一次小型交付'], evidence: ['问卷答案'] },
    { id: 'c2', title: '排除条件', summary: '避免长期无反馈', details: ['在面试中核对'], evidence: [] },
  ],
  risks: [{ title: '过度分析', detail: '可能拖延行动', mitigation: '设置截止时间' }],
  nextActions: [
    { title: '列出选项', detail: '保留三个', timeframe: '本周' },
    { title: '完成访谈', detail: '核对真实工作', timeframe: '两周内' },
  ],
  reflectionQuestions: [],
  disclaimer: '仅用于自我探索。',
};

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
});

afterEach(() => cleanup());

function saveCompletedReport() {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', context),
    step: 'report',
    paymentReceipt: 'signed-receipt',
    report,
  }, window.sessionStorage);
}

it('renders the completed report from this tab without exposing birth data in the URL', async () => {
  saveCompletedReport();
  render(<DeepReportPage />);

  expect(await screen.findByRole('heading', { name: '你的职业方向深度分析' })).toBeTruthy();
  expect(screen.getByText('先看结论')).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: '报告操作' })).toBeNull();
  expect(screen.queryByText('继续探索')).toBeNull();
  expect(screen.queryByRole('button', { name: /探索方向/ })).toBeNull();
  expect(screen.getByRole('button', { name: '返回基础报告' })).toBeTruthy();
});

it('offers a safe recovery when no report exists in this tab', async () => {
  render(<DeepReportPage />);

  expect(await screen.findByText('这份深度报告已不在当前标签页中')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
  expect(push).toHaveBeenCalledWith('/');
});

it('opens the validator with a session id only, never the signed capability', async () => {
  const careerReport = createSampleCareerReport({
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
  saveDeepSession({
    ...createInitialDeepState('session-12345678', context),
    step: 'report',
    report: careerReport,
    validationAccess: [{
      careerId: 'career-1-abc', validationSessionId: '123e4567-e89b-42d3-a456-426614174001', capability: 'signed-capability',
    }],
  }, window.sessionStorage);

  render(<DeepReportPage />);
  const link = await screen.findByRole('link', { name: /开始真实任务验证/ });
  expect(link.getAttribute('href')).toBe('/career-validation/123e4567-e89b-42d3-a456-426614174001');
  expect(link.getAttribute('href')).not.toContain('signed-capability');
});
