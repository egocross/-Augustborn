import { expect, it } from 'vitest';

import { consumeDeepReportStream } from './stream';

const report = {
  title: '职业方向', summary: '摘要', keyFindings: ['A', 'B'],
  cards: [{ id: 'c1', title: '结论', summary: '简述', details: ['详情'], evidence: [] }, { id: 'c2', title: '验证', summary: '简述', details: ['详情'], evidence: [] }],
  risks: [{ title: '风险', detail: '细节', mitigation: '应对' }],
  nextActions: [{ title: '行动1', detail: '做事', timeframe: '一周' }, { title: '行动2', detail: '复盘', timeframe: '一月' }],
  reflectionQuestions: [], disclaimer: '仅供探索。',
};

it('parses fragmented SSE, ignores heartbeat, and returns the complete report', async () => {
  const encoded = `data: ${JSON.stringify({ type: 'status', stage: 'preparing' })}\n\ndata: ${JSON.stringify({ type: 'heartbeat' })}\n\ndata: ${JSON.stringify({ type: 'report', report })}\n\n`;
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    const bytes = new TextEncoder().encode(encoded);
    controller.enqueue(bytes.slice(0, 17)); controller.enqueue(bytes.slice(17)); controller.close();
  } });
  const stages: string[] = [];
  await expect(consumeDeepReportStream(body, { onStatus: (stage) => stages.push(stage) })).resolves.toEqual(report);
  expect(stages).toEqual(['preparing']);
});

it('surfaces stable streamed error codes', async () => {
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', code: 'parse_failed', message: '失败' })}\n\n`));
    controller.close();
  } });
  await expect(consumeDeepReportStream(body)).rejects.toMatchObject({ code: 'parse_failed' });
});
