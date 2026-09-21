import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { DeepAnswers, DeepReport, DirectionId } from './types';

export type DeepSessionEvent = {
  id: string;
  selectedDirection: DirectionId;
  questionnaireVersion: 'v1';
  answers: DeepAnswers;
  optionalContext: string;
  customQuestion: string | null;
  paymentStatus: 'unpaid' | 'processing' | 'paid' | 'failed';
  reportStatus: 'not_started' | 'generating' | 'complete' | 'failed';
  reportResult: DeepReport | null;
};

export async function persistDeepSession(event: DeepSessionEvent): Promise<{ persisted: boolean }> {
  try {
    const client = getSupabaseAdmin();
    if (!client) return { persisted: false };
    const { error } = await client.from('deep_report_sessions').upsert({
      id: event.id,
      selected_direction: event.selectedDirection,
      questionnaire_version: event.questionnaireVersion,
      answers: event.answers,
      optional_context: event.optionalContext,
      custom_question: event.customQuestion,
      payment_status: event.paymentStatus,
      report_status: event.reportStatus,
      report_result: event.reportResult,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { persisted: true };
  } catch {
    console.warn('deep_session_persistence_unavailable', { id: event.id, status: event.reportStatus });
    return { persisted: false };
  }
}
