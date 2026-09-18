import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { BirthForm } from './birth-form';

const report = {
  disclaimer: '仅供参考',
  sections: [{ heading: '模型章节', body: '模型内容', bullets: [] }],
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(report), { status: 200 })),
  );
});

it('submits only lunar date and China-standard-time fields, then renders the report in memory', async () => {
  render(<BirthForm />);

  fireEvent.change(screen.getByLabelText('农历年份'), { target: { value: '1977' } });
  fireEvent.change(screen.getByLabelText('农历月份'), { target: { value: '9' } });
  fireEvent.change(screen.getByLabelText('农历日期'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('小时'), { target: { value: '13' } });
  fireEvent.change(screen.getByLabelText('分钟'), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: '开始分析' }));

  await waitFor(() => expect(screen.getByText('模型章节')).toBeTruthy());
  expect(fetch).toHaveBeenCalledWith('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lunarYear: 1977, lunarMonth: 9, lunarDay: 3, hour: 13, minute: 30 }),
  });
});
