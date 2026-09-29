import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { CareerCalibration } from './career-calibration';
import { CAREER_QUESTIONNAIRE_VERSION } from './career-calibration-questions';
import type { DeepReport } from './types';
import { CAREER_DIRECTION_ID } from './types';

export type DeepSessionEvent = {
  id: string;
  selectedDirection: typeof CAREER_DIRECTION_ID;
  questionnaireVersion: typeof CAREER_QUESTIONNAIRE_VERSION;
  careerCalibration: CareerCalibration;
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
      answers: event.careerCalibration,
      optional_context: null,
      custom_question: null,
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
