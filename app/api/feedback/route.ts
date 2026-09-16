import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { feedbackSchema } from '@/lib/validation';

const invalidRequest = () => Response.json({ error: '反馈格式无效。' }, { status: 400 });

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidRequest();
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return invalidRequest();
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: '反馈服务尚未配置。' }, { status: 503 });
  }

  try {
    const { error } = await supabase.from('feedback').insert({
      rating: parsed.data.rating,
      wants_deep_analysis: parsed.data.wantsDeepAnalysis,
    });

    if (error) {
      return Response.json({ error: '反馈暂时无法保存，请稍后重试。' }, { status: 503 });
    }
  } catch {
    return Response.json({ error: '反馈暂时无法保存，请稍后重试。' }, { status: 503 });
  }

  return new Response(null, { status: 204 });
}
