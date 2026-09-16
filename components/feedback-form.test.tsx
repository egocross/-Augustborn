import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { FeedbackForm } from './feedback-form';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
});

it('sends only rating and deep-analysis intent', async () => {
  render(<FeedbackForm />);

  fireEvent.click(screen.getByLabelText('4 分'));
  fireEvent.click(screen.getByLabelText('愿意继续深度分析'));
  fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));

  await waitFor(() => expect(screen.getByText('感谢你的反馈。')).toBeTruthy());
  expect(fetch).toHaveBeenCalledWith('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: 4, wantsDeepAnalysis: true }),
  });
});
