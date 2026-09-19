import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

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

it('sends the birth date, time and region, then renders the streamed report', async () => {
  render(<BirthForm />);

  expect(screen.getByText('发现更适合你的方向')).toBeTruthy();
  expect(screen.getByText('填写出生信息')).toBeTruthy();

  fireEvent.change(screen.getByLabelText('出生日期'), { target: { value: '1977-09-03' } });
  fireEvent.change(screen.getByLabelText('出生时间'), { target: { value: '13:30' } });
  fireEvent.change(screen.getByLabelText('出生地区'), { target: { value: '浙江杭州' } });
  fireEvent.click(screen.getByRole('button', { name: '生成我的探索报告' }));

  await waitFor(() => expect(screen.getByText('模型章节')).toBeTruthy());
  expect(fetch).toHaveBeenCalledWith('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birthDate: '1977-09-03', birthTime: '13:30', birthRegion: '浙江杭州' }),
  });
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
  expect(fetch).toHaveBeenCalledWith('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birthDate: '1990-01-02', birthTime: null, birthRegion: '' }),
  });
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
  expect(screen.getByRole('dialog', { name: '正在生成报告' })).toBeTruthy();
  expect(document.querySelector('.progress-track')).toBeTruthy();
  expect(document.querySelector('.birth-flow.is-generating')).toBeTruthy();
});
