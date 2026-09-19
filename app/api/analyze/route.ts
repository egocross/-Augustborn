import type { AnalyzeStreamEvent } from '@/lib/analyze-stream';
import { createChart } from '@/lib/bazi/chart';
import { generateReportStream } from '@/lib/gemini/generate-report';
import { parseReport } from '@/lib/gemini/schema';
import { analysisSchema } from '@/lib/validation';

const invalidRequest = () => Response.json({ error: '输入格式无效。' }, { status: 400 });
const unavailable = () =>
  Response.json({ error: '分析暂时不可用，请稍后重试。' }, { status: 503 });

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidRequest();
  }

  const parsed = analysisSchema.safeParse(body);
  if (!parsed.success) {
    return invalidRequest();
  }

  let chart: ReturnType<typeof createChart>;
  try {
    chart = createChart(parsed.data);
  } catch {
    return unavailable();
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AnalyzeStreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      send({ type: 'status', stage: 'thinking' });

      let text = '';
      try {
        for await (const delta of generateReportStream(chart)) {
          text += delta;
          send({ type: 'delta', text: delta });
        }

        send({ type: 'report', report: parseReport(JSON.parse(text)) });
      } catch (error) {
        console.error(
          'analyze_failed',
          error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        );
        send({ type: 'error', message: '分析暂时不可用，请稍后重试。' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'cache-control': 'no-cache, no-transform',
      'content-type': 'text/event-stream; charset=utf-8',
    },
  });
}
