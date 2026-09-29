import { expect, it, vi } from 'vitest';

import { consumeAnalyzeStream, extractCompleteSections } from './analyze-stream';

const encoder = new TextEncoder();

const sseStream = (events: unknown[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });

it('extracts only the sections that finished streaming', () => {
  const partial =
    '{"sections":[{"heading":"一","body":"甲","bullets":[]},{"heading":"二","body":"乙","bul';

  expect(extractCompleteSections(partial)).toEqual([{ heading: '一', body: '甲', bullets: [] }]);
  expect(extractCompleteSections('{"sections":')).toEqual([]);
});

it('ignores braces inside section text', () => {
  const partial = '{"sections":[{"heading":"一","body":"含 { 括号","bullets":["a}b"]}';

  expect(extractCompleteSections(partial)).toEqual([
    { heading: '一', body: '含 { 括号', bullets: ['a}b'] },
  ]);
});

it('reads deltas and resolves with the signed finished report handoff', async () => {
  const report = { sections: [{ heading: '一', body: '甲', bullets: [] }], disclaimer: '仅供参考' };
  const onDelta = vi.fn();
  const onStatus = vi.fn();

  await expect(
    consumeAnalyzeStream(
      sseStream([
        { type: 'status', stage: 'thinking' },
        { type: 'delta', text: '{"sections":' },
        { type: 'delta', text: '[]}' },
        { type: 'report', report, snapshotToken: 'v1.digest.signature' },
      ]),
      { onDelta, onStatus },
    ),
  ).resolves.toEqual({ report, snapshotToken: 'v1.digest.signature' });

  expect(onDelta).toHaveBeenCalledTimes(2);
  expect(onStatus).toHaveBeenCalledWith('thinking');
});

it('rejects a completed report event without its snapshot token', async () => {
  const report = { sections: [{ heading: '一', body: '甲', bullets: [] }], disclaimer: '仅供参考' };

  await expect(
    consumeAnalyzeStream(sseStream([{ type: 'report', report }])),
  ).rejects.toThrow('缺少基础报告校验凭证');
});

it('throws the server message when the stream reports a failure', async () => {
  await expect(
    consumeAnalyzeStream(sseStream([{ type: 'error', message: '分析暂时不可用，请稍后重试。' }])),
  ).rejects.toThrow('分析暂时不可用，请稍后重试。');
});
