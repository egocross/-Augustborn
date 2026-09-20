import { z } from 'zod';

import { ReportSchema, type Report } from '@/lib/gemini/schema';
import { analysisSchema } from '@/lib/validation';
import { DeepAnswersSchema, DeepReportSchema, DirectionIdSchema, DynamicQuestionSchema, type DeepAnswers, type DeepReport, type DirectionId, type DynamicQuestion } from './types';

export const DEEP_SESSION_KEY = 'jianvia.deep-analysis';
export const SESSION_VERSION = 1 as const;

export type DeepStep = 'direction' | 'custom-question' | 'custom-loading' | 'questions' | 'optional-context' | 'payment' | 'generating' | 'report';
export type DeepFlowState = {
  sessionId: string; step: DeepStep; selectedDirection: DirectionId | null; questionIndex: number;
  answers: DeepAnswers; optionalContext: string; customQuestion: string; customQuestions: DynamicQuestion[];
  paymentReceipt: string | null; report: DeepReport | null; errorCode: string | null;
  birthInput: z.infer<typeof analysisSchema> | null; freeReport: Report | null;
};

const DeepFlowStateSchema = z.object({
  sessionId: z.string().min(8), step: z.enum(['direction', 'custom-question', 'custom-loading', 'questions', 'optional-context', 'payment', 'generating', 'report']),
  selectedDirection: DirectionIdSchema.nullable(), questionIndex: z.number().int().min(0).max(5), answers: DeepAnswersSchema,
  optionalContext: z.string().max(2000), customQuestion: z.string().max(1000), customQuestions: z.array(DynamicQuestionSchema).max(5),
  paymentReceipt: z.string().nullable(), report: DeepReportSchema.nullable(), errorCode: z.string().nullable(),
  birthInput: analysisSchema.nullable(), freeReport: ReportSchema.nullable(),
});

export function createInitialDeepState(
  sessionId: string,
  context: { birthInput?: z.infer<typeof analysisSchema>; freeReport?: Report } = {},
): DeepFlowState {
  return {
    sessionId, step: 'direction', selectedDirection: null, questionIndex: 0, answers: {},
    optionalContext: '', customQuestion: '', customQuestions: [], paymentReceipt: null,
    report: null, errorCode: null, birthInput: context.birthInput ?? null, freeReport: context.freeReport ?? null,
  };
}

export type DeepFlowAction =
  | { type: 'chooseDirection'; directionId: DirectionId }
  | { type: 'setAnswer'; questionId: string; answer: DeepAnswers[string] }
  | { type: 'setCustomQuestion'; value: string }
  | { type: 'customLoading' }
  | { type: 'customQuestionsReady'; questions: DynamicQuestion[] }
  | { type: 'customQuestionsFailed'; code: string }
  | { type: 'setOptionalContext'; value: string }
  | { type: 'nextQuestion'; total: number }
  | { type: 'previousQuestion' }
  | { type: 'goToPayment' }
  | { type: 'generationStarted'; receipt: string }
  | { type: 'generationSucceeded'; report: DeepReport }
  | { type: 'generationFailed'; code: string }
  | { type: 'backToDirection' };

export function deepFlowReducer(state: DeepFlowState, action: DeepFlowAction): DeepFlowState {
  switch (action.type) {
    case 'chooseDirection': return { ...state, selectedDirection: action.directionId, step: action.directionId === 'custom' ? 'custom-question' : 'questions', questionIndex: 0, answers: {}, customQuestions: [], errorCode: null, paymentReceipt: null, report: null };
    case 'setAnswer': return { ...state, answers: { ...state.answers, [action.questionId]: action.answer }, errorCode: null };
    case 'setCustomQuestion': return { ...state, customQuestion: action.value, errorCode: null };
    case 'customLoading': return { ...state, step: 'custom-loading', errorCode: null };
    case 'customQuestionsReady': return { ...state, customQuestions: action.questions, step: action.questions.length ? 'questions' : 'optional-context', questionIndex: 0 };
    case 'customQuestionsFailed': return { ...state, step: 'custom-question', errorCode: action.code };
    case 'setOptionalContext': return { ...state, optionalContext: action.value };
    case 'nextQuestion': return action.total > state.questionIndex + 1 ? { ...state, questionIndex: state.questionIndex + 1 } : { ...state, step: 'optional-context' };
    case 'previousQuestion': return state.questionIndex > 0 ? { ...state, questionIndex: state.questionIndex - 1 } : { ...state, step: state.selectedDirection === 'custom' ? 'custom-question' : 'direction' };
    case 'goToPayment': return { ...state, step: 'payment', errorCode: null };
    case 'generationStarted': return { ...state, paymentReceipt: action.receipt, step: 'generating', errorCode: null };
    case 'generationSucceeded': return { ...state, report: action.report, step: 'report', errorCode: null };
    case 'generationFailed': return { ...state, step: 'payment', errorCode: action.code };
    case 'backToDirection': return { ...createInitialDeepState(state.sessionId, { ...(state.birthInput ? { birthInput: state.birthInput } : {}), ...(state.freeReport ? { freeReport: state.freeReport } : {}) }) };
  }
}

export function saveDeepSession(state: DeepFlowState, storage: Storage = sessionStorage) {
  storage.setItem(DEEP_SESSION_KEY, JSON.stringify({ version: SESSION_VERSION, state }));
}

export function loadDeepSession(storage: Storage = sessionStorage): DeepFlowState | null {
  try {
    const raw = storage.getItem(DEEP_SESSION_KEY);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as { version?: unknown; state?: unknown };
    if (envelope.version !== SESSION_VERSION) return null;
    const parsed = DeepFlowStateSchema.safeParse(envelope.state);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export function clearDeepSession(storage: Storage = sessionStorage) {
  storage.removeItem(DEEP_SESSION_KEY);
}
