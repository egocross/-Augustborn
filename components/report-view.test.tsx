import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { ReportView } from './report-view';

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
