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
