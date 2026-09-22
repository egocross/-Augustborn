import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { FeedbackForm } from './feedback-form';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
});

afterEach(() => cleanup());

it('does not ask users to repeat their deep-analysis intent', () => {
  render(<FeedbackForm />);

  expect(screen.queryByLabelText('愿意继续深度分析')).toBeNull();
});

it('starts directly with the useful feedback question', () => {
  render(<FeedbackForm />);

  expect(screen.getByRole('heading', { name: '这份报告贴近你吗？' })).toBeTruthy();
  expect(screen.queryByText('读后感')).toBeNull();
});

it('submits only the selected accuracy rating', async () => {
  render(<FeedbackForm />);

  fireEvent.click(screen.getByLabelText('4 分'));
  fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));

  await waitFor(() => expect(screen.getByRole('dialog', { name: '谢谢你的反馈' })).toBeTruthy());
  expect(fetch).toHaveBeenCalledWith('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: 4 }),
  });
});

it('shows an expressive success dialog and keeps a compact submitted state after closing', async () => {
  render(<FeedbackForm />);

  fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));

  const dialog = await screen.findByRole('dialog', { name: '谢谢你的反馈' });
  expect(dialog).toBeTruthy();
  expect(screen.getByText('😊')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: '完成' }));

  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('已提交反馈')).toBeTruthy();
});

it('closes the success dialog with Escape', async () => {
  render(<FeedbackForm />);

  fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));
  await screen.findByRole('dialog', { name: '谢谢你的反馈' });

  fireEvent.keyDown(document, { key: 'Escape' });

  expect(screen.queryByRole('dialog')).toBeNull();
});
