import { createChart } from '@/lib/bazi/chart';
import { generateReport } from '@/lib/gemini/generate-report';
import { analysisSchema } from '@/lib/validation';

const invalidRequest = () => Response.json({ error: '输入格式无效。' }, { status: 400 });

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

  try {
    const chart = createChart(parsed.data);
    const report = await generateReport(chart);

    return Response.json(report);
  } catch {
    return Response.json({ error: '分析暂时不可用，请稍后重试。' }, { status: 503 });
  }
}
