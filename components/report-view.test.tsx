import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { ReportView } from './report-view';

afterEach(() => cleanup());

it('renders an arbitrary model-provided section', () => {
  render(
    <ReportView
      report={{
        disclaimer: '参考',
        sections: [{ heading: '模型标题', body: '模型正文', bullets: [] }],
      }}
    />,
  );

  expect(screen.getByText('模型标题')).toBeTruthy();
});

it('shows completed sections while the rest of the report is still streaming', () => {
  render(
    <ReportView
      pending
      report={{
        disclaimer: '',
        sections: [{ heading: '流式标题', body: '流式正文', bullets: [] }],
      }}
    />,
  );

  expect(screen.getByText('流式标题')).toBeTruthy();
  expect(screen.getByText('正在继续生成…')).toBeTruthy();
  expect(document.querySelector('.skeleton')).toBeTruthy();
});

it('drops a leading list number the model copied into a heading', () => {
  render(
    <ReportView
      report={{
        disclaimer: '',
        sections: [{ heading: '1. 核心性格与底层矛盾', body: '正文', bullets: [] }],
      }}
    />,
  );

  expect(screen.getByText('核心性格与底层矛盾')).toBeTruthy();
});

it('replaces a long model disclaimer with the concise product disclaimer', () => {
  const { getByText, queryByText } = render(
    <ReportView
      report={{
        disclaimer: '这是一段很长的模型免责声明，不应该分散用户阅读报告的注意力。',
        sections: [{ heading: '标题', body: '正文', bullets: [] }],
      }}
    />,
  );

  expect(
    getByText('仅供自我探索参考，不构成医疗、法律、财务或职业决策建议。'),
  ).toBeTruthy();
  expect(queryByText(/\u8fd9是一段很长的模型免责声明/)).toBeNull();
});
