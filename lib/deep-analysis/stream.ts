import { DeepReportSchema, type DeepReport } from './types';

export type DeepStreamErrorCode = 'timeout' | 'upstream_failed' | 'parse_failed';
export class DeepStreamError extends Error {
  constructor(public readonly code: DeepStreamErrorCode, message: string) {
    super(message);
    this.name = 'DeepStreamError';
  }
}

type DeepStreamEvent =
  | { type: 'status'; stage: string }
  | { type: 'heartbeat' }
  | { type: 'delta'; text: string }
  | { type: 'report'; report: DeepReport }
  | { type: 'error'; code: DeepStreamErrorCode; message: string };

export async function consumeDeepReportStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: { onStatus?: (stage: string) => void; onDelta?: (text: string) => void } = {},
): Promise<DeepReport> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let report: DeepReport | null = null;

  const consume = (block: string) => {
    const line = block.split('\n').find((value) => value.startsWith('data: '));
    if (!line) return;
    const event = JSON.parse(line.slice(6)) as DeepStreamEvent;
    if (event.type === 'status') callbacks.onStatus?.(event.stage);
    if (event.type === 'delta') callbacks.onDelta?.(event.text);
    if (event.type === 'report') report = DeepReportSchema.parse(event.report);
    if (event.type === 'error') throw new DeepStreamError(event.code, event.message);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) consume(block);
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
  if (!report) throw new DeepStreamError('parse_failed', '未收到完整报告。');
  return report;
}
