import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { push, scrollTo } = vi.hoisted(() => ({ push: vi.fn(), scrollTo: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { createInitialDeepState, loadDeepSession, saveDeepSession } from '@/lib/deep-analysis/session';
import { BirthForm } from './birth-form';

const report = {
  disclaimer: '仅供参考',
  sections: [{ heading: '模型章节', body: '模型内容', bullets: [] }],
};

const encoder = new TextEncoder();

const streamResponse = (events: unknown[]) => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });

  return { ok: true, body, json: async () => ({}) } as unknown as Response;
};

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
  scrollTo.mockReset();
  vi.stubGlobal('scrollTo', scrollTo);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      streamResponse([
        { type: 'status', stage: 'thinking' },
        { type: 'delta', text: JSON.stringify(report) },
        { type: 'report', report },
      ]),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('does not read session storage during its hydration-sensitive initial render', () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678'),
    birthInput: { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州' },
    freeReport: { disclaimer: '仅供参考', sections: [{ heading: '旧报告', body: '旧内容', bullets: [] }] },
  }, window.sessionStorage);

  const html = renderToString(<BirthForm />);
  expect(html).toContain('发现更适合你的方向');
  expect(html).not.toContain('旧报告');
});

it('keeps direction choices off the free report and opens a separate exploration page', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678'),
    birthInput: { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州' },
    freeReport: { disclaimer: '仅供参考', sections: [{ heading: '旧报告', body: '旧内容', bullets: [] }] },
  }, window.sessionStorage);

  render(<BirthForm />);

  expect(await screen.findByText('旧报告')).toBeTruthy();
  expect(screen.queryByText('接下来，你最想进一步弄清楚什么？')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '开始深入探索' }));

  expect(push).toHaveBeenCalledWith('/explore');
  expect(loadDeepSession(window.sessionStorage)?.freeReport?.sections[0]?.heading).toBe('旧报告');
});

it('presents deep exploration before the secondary feedback action', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678'),
    birthInput: { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州' },
    freeReport: { disclaimer: '仅供参考', sections: [{ heading: '旧报告', body: '旧内容', bullets: [] }] },
  }, window.sessionStorage);

  render(<BirthForm />);

  const exploration = await screen.findByRole('button', { name: '开始深入探索' });
  const feedback = screen.getByRole('heading', { name: '这份报告贴近你吗？' });

  expect(exploration.compareDocumentPosition(feedback) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('sends the birth date, time and region, then renders the streamed report', async () => {
  render(<BirthForm />);

  expect(screen.getByText('发现更适合你的方向')).toBeTruthy();
  expect(screen.getByText('填写出生信息')).toBeTruthy();
  expect(screen.queryByText('接下来，你最想进一步弄清楚什么？')).toBeNull();

  fireEvent.change(screen.getByLabelText('出生日期'), { target: { value: '1977-09-03' } });
  fireEvent.change(screen.getByLabelText('出生时间'), { target: { value: '13:30' } });
  fireEvent.change(screen.getByLabelText('出生地区'), { target: { value: '浙江杭州' } });
  fireEvent.click(screen.getByRole('button', { name: '生成我的探索报告' }));

  await waitFor(() => expect(screen.getByText('模型章节')).toBeTruthy());
  expect(await screen.findByRole('button', { name: '开始深入探索' })).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith('/api/analyze', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birthDate: '1977-09-03', birthTime: '13:30', birthRegion: '浙江杭州' }),
  }));
});

it('brings the reader back to the top when the streamed report replaces the form', async () => {
  render(<BirthForm />);

  fireEvent.change(screen.getByLabelText('出生日期'), { target: { value: '1977-09-03' } });
  fireEvent.change(screen.getByLabelText('出生时间'), { target: { value: '13:30' } });
  fireEvent.click(screen.getByRole('button', { name: '生成我的探索报告' }));

  await waitFor(() => expect(screen.getByText('模型章节')).toBeTruthy());
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0 });
});

it('disables the time input and sends a null birth time when the time is unknown', async () => {
  render(<BirthForm />);

  fireEvent.change(screen.getByLabelText('出生日期'), { target: { value: '1990-01-02' } });
  fireEvent.click(screen.getByLabelText('不知道准确出生时间'));

  const timeInput = screen.getByLabelText('出生时间') as HTMLInputElement;
  expect(timeInput.disabled).toBe(true);
  expect(screen.getByText('时间未知时，报告会跳过依赖出生时间的分析。')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: '生成我的探索报告' }));

  await waitFor(() => expect(screen.getByText('模型章节')).toBeTruthy());
  expect(fetch).toHaveBeenCalledWith('/api/analyze', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birthDate: '1990-01-02', birthTime: null, birthRegion: '' }),
  }));
});

it('shows a running progress indicator while the report is generating', async () => {
  const pending = new ReadableStream<Uint8Array>({ start() {} });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, body: pending, json: async () => ({}) } as unknown as Response),
  );

  render(<BirthForm />);

  fireEvent.change(screen.getByLabelText('出生日期'), { target: { value: '1977-10-15' } });
  fireEvent.change(screen.getByLabelText('出生时间'), { target: { value: '13:30' } });
  fireEvent.click(screen.getByRole('button', { name: '生成我的探索报告' }));

  await waitFor(() => expect(screen.getByText('正在读取出生信息…')).toBeTruthy());
  const dialog = screen.getByRole('dialog', { name: '正在生成报告' });
  expect(dialog).toBeTruthy();
  expect(dialog.getAttribute('data-appearance')).toBe('dark-glass');
  expect(document.querySelector('.progress-track')).toBeTruthy();
  expect(document.querySelector('.birth-flow.is-generating')).toBeTruthy();
});
