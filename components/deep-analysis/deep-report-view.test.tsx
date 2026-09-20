import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { DeepReportView } from './deep-report-view';

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
