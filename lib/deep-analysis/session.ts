import { z } from 'zod';

import { ReportSchema, type Report } from '@/lib/gemini/schema';
import {
  CareerCalibrationSchema,
  CareerDraftAnswersSchema,
  type CareerCalibration,
  type CareerDraftAnswer,
  type CareerDraftAnswers,
} from './career-calibration';
import {
  CAREER_QUESTIONS,
  CAREER_SECTIONS,
  getVisibleCareerQuestions,
  pruneHiddenCareerAnswers,
} from './career-calibration-questions';
import { DeepReportSchema, type DeepReport } from './types';
import type { ValidationAccess } from './stream';

export { CAREER_DIRECTION_ID } from './types';

export const DEEP_SESSION_KEY = 'jianvia.deep-analysis';
export const SESSION_VERSION = 4 as const;

const ValidationAccessSchema = z.object({
  careerId: z.string().min(1), validationSessionId: z.string().uuid(), capability: z.string().min(1),
}).strict();

export type CareerStep = 'intro' | 'questions' | 'summary' | 'payment' | 'generating' | 'report';

export type DeepFlowState = {
  sessionId: string;
  step: CareerStep;
  sectionIndex: number;
  questionIndex: number;
  answers: CareerDraftAnswers;
  calibration: CareerCalibration | null;
  summaryConfirmed: boolean;
  paymentOrderId: string | null;
  paymentReceipt: string | null;
  report: DeepReport | null;
  errorCode: string | null;
  freeReport: Report | null;
  baseReportSnapshotToken: string | null;
  readOnlyLegacy: boolean;
  validationAccess: ValidationAccess[];
};

const DeepFlowStateSchema = z.object({
  sessionId: z.string().min(8),
  step: z.enum(['intro', 'questions', 'summary', 'payment', 'generating', 'report']),
  sectionIndex: z.number().int().min(0).max(CAREER_SECTIONS.length - 1),
  questionIndex: z.number().int().min(0),
  answers: CareerDraftAnswersSchema,
  calibration: CareerCalibrationSchema.nullable(),
  summaryConfirmed: z.boolean(),
  paymentOrderId: z.string().uuid().nullable(),
  paymentReceipt: z.string().min(1).nullable(),
  report: DeepReportSchema.nullable(),
  errorCode: z.string().nullable(),
  freeReport: ReportSchema.nullable(),
  baseReportSnapshotToken: z.string().min(1).nullable(),
  readOnlyLegacy: z.boolean(),
  validationAccess: z.array(ValidationAccessSchema).optional(),
});

type CareerContext = {
  freeReport?: Report;
  baseReportSnapshotToken?: string;
};

const createSessionId = () => {
  const generated = globalThis.crypto?.randomUUID?.();
  return typeof generated === 'string' && generated.length >= 8 ? generated : `session-${Date.now()}`;
};

export function createInitialCareerState(
  sessionId: string,
  context: CareerContext = {},
): DeepFlowState {
  return {
    sessionId,
    step: 'intro',
    sectionIndex: 0,
    questionIndex: 0,
    answers: {},
    calibration: null,
    summaryConfirmed: false,
    paymentOrderId: null,
    paymentReceipt: null,
    report: null,
    errorCode: null,
    freeReport: context.freeReport ?? null,
    baseReportSnapshotToken: context.baseReportSnapshotToken ?? null,
    readOnlyLegacy: false,
    validationAccess: [],
  };
}

/** @deprecated Kept temporarily while the career UI migration lands. */
export const createInitialDeepState = createInitialCareerState;

type Cursor = { sectionIndex: number; questionIndex: number; questionId: string };

const visibleCursors = (answers: CareerDraftAnswers): Cursor[] => {
  const visible = new Set(getVisibleCareerQuestions(answers).map((question) => question.id));
  return CAREER_SECTIONS.flatMap((section, sectionIndex) => {
    const sectionQuestions = CAREER_QUESTIONS.filter(
      (question) => question.section === section.id && visible.has(question.id),
    );
    return sectionQuestions.map((question, questionIndex) => ({
      sectionIndex,
      questionIndex,
      questionId: question.id,
    }));
  });
};

const cursorIndex = (state: DeepFlowState, cursors: Cursor[]): number =>
  cursors.findIndex(
    (cursor) => cursor.sectionIndex === state.sectionIndex && cursor.questionIndex === state.questionIndex,
  );

export type DeepFlowAction =
  | { type: 'restore'; state: DeepFlowState }
  | { type: 'beginQuestions' }
  | { type: 'setAnswer'; questionId: string; answer: CareerDraftAnswer }
  | { type: 'setAnswerAndAdvance'; questionId: string; answer: CareerDraftAnswer }
  | { type: 'nextQuestion' }
  | { type: 'previousQuestion' }
  | { type: 'goToQuestion'; sectionIndex: number; questionIndex: number }
  | { type: 'editSummary' }
  | { type: 'confirmSummary'; calibration: CareerCalibration }
  | { type: 'paymentStarted'; orderId: string }
  | { type: 'paymentConfirmed'; receipt: string }
  | { type: 'generationStarted'; receipt: string }
  | { type: 'generationSucceeded'; report: DeepReport; validationAccess?: ValidationAccess[] }
  | { type: 'generationFailed'; code: string };

export function deepFlowReducer(state: DeepFlowState, action: DeepFlowAction): DeepFlowState {
  switch (action.type) {
    case 'restore':
      return action.state;
    case 'beginQuestions':
      return {
        ...state, step: 'questions', sectionIndex: 0, questionIndex: 0,
        summaryConfirmed: false, calibration: null, errorCode: null,
      };
    case 'setAnswer': {
      const answers = pruneHiddenCareerAnswers({
        ...state.answers,
        [action.questionId]: action.answer,
      });
      return {
        ...state,
        answers,
        summaryConfirmed: false,
        calibration: null,
        errorCode: null,
      };
    }
    case 'setAnswerAndAdvance': {
      const answered = deepFlowReducer(state, {
        type: 'setAnswer', questionId: action.questionId, answer: action.answer,
      });
      return deepFlowReducer(answered, { type: 'nextQuestion' });
    }
    case 'nextQuestion': {
      const answers = pruneHiddenCareerAnswers(state.answers);
      const cursors = visibleCursors(answers);
      const current = cursorIndex(state, cursors);
      const next = current >= 0 ? cursors[current + 1] : cursors[0];
      return next
        ? { ...state, answers, step: 'questions', ...next, errorCode: null }
        : { ...state, answers, step: 'summary', errorCode: null };
    }
    case 'previousQuestion': {
      const cursors = visibleCursors(state.answers);
      const current = cursorIndex(state, cursors);
      const previous = current > 0 ? cursors[current - 1] : null;
      return previous
        ? { ...state, step: 'questions', ...previous, errorCode: null }
        : { ...state, step: 'intro', sectionIndex: 0, questionIndex: 0, errorCode: null };
    }
    case 'goToQuestion':
      return {
        ...state, step: 'questions', sectionIndex: action.sectionIndex,
        questionIndex: action.questionIndex, errorCode: null,
      };
    case 'editSummary': {
      const cursors = visibleCursors(state.answers);
      const last = cursors.at(-1);
      return last
        ? { ...state, step: 'questions', ...last, summaryConfirmed: false, calibration: null, errorCode: null }
        : { ...state, step: 'intro', summaryConfirmed: false, calibration: null, errorCode: null };
    }
    case 'confirmSummary':
      return {
        ...state, step: 'payment', calibration: action.calibration,
        summaryConfirmed: true, errorCode: null,
      };
    case 'paymentStarted':
      return { ...state, paymentOrderId: action.orderId, paymentReceipt: null, errorCode: null };
    case 'paymentConfirmed':
      return { ...state, paymentReceipt: action.receipt, errorCode: null };
    case 'generationStarted':
      return { ...state, paymentReceipt: action.receipt, step: 'generating', errorCode: null };
    case 'generationSucceeded':
      return { ...state, report: action.report, validationAccess: action.validationAccess ?? [], step: 'report', errorCode: null };
    case 'generationFailed':
      return { ...state, step: 'payment', errorCode: action.code };
  }
}

export function saveDeepSession(state: DeepFlowState, storage: Storage = sessionStorage) {
  storage.setItem(DEEP_SESSION_KEY, JSON.stringify({ version: SESSION_VERSION, state }));
}

const normalizeRestoredState = (state: DeepFlowState): DeepFlowState | null => {
  if (state.step === 'generating') {
    return { ...state, step: 'payment', errorCode: 'interrupted' };
  }
  if (state.step === 'report') {
    return state.report ? state : null;
  }
  if (!state.freeReport || !state.baseReportSnapshotToken || state.readOnlyLegacy) return null;
  if (state.step === 'payment' && (!state.summaryConfirmed || !state.calibration)) return null;
  if (state.step === 'questions') {
    const cursors = visibleCursors(state.answers);
    if (cursorIndex(state, cursors) < 0) return { ...state, sectionIndex: 0, questionIndex: 0 };
  }
  return state;
};

const migrateLegacyState = (value: unknown): DeepFlowState | null => {
  if (!value || typeof value !== 'object') return null;
  const state = value as Record<string, unknown>;
  const sessionId = typeof state.sessionId === 'string' && state.sessionId.length >= 8
    ? state.sessionId
    : createSessionId();
  const parsedReport = DeepReportSchema.safeParse(state.report ?? state.lastReport);
  if (parsedReport.success) {
    return {
      ...createInitialCareerState(sessionId),
      step: 'report',
      report: parsedReport.data,
      readOnlyLegacy: true,
    };
  }
  const parsedFreeReport = ReportSchema.safeParse(state.freeReport);
  return parsedFreeReport.success
    ? createInitialCareerState(sessionId, { freeReport: parsedFreeReport.data })
    : null;
};

export function loadDeepSession(storage: Storage = sessionStorage): DeepFlowState | null {
  try {
    const raw = storage.getItem(DEEP_SESSION_KEY);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as { version?: unknown; state?: unknown };
    if (envelope.version === 2) return migrateLegacyState(envelope.state);
    if (envelope.version !== 3 && envelope.version !== SESSION_VERSION) return null;
    const parsed = DeepFlowStateSchema.safeParse(envelope.state);
    return parsed.success ? normalizeRestoredState({ ...parsed.data, validationAccess: parsed.data.validationAccess ?? [] }) : null;
  } catch {
    return null;
  }
}

/**
 * Stores only the immutable base report and its server-issued proof. A newly
 * generated base report invalidates any unfinished calibration in this tab.
 */
export function saveFreeReportContext(
  context: { freeReport: Report; baseReportSnapshotToken: string },
  storage: Storage = sessionStorage,
): DeepFlowState {
  const restored = loadDeepSession(storage);
  const next = createInitialCareerState(restored?.sessionId ?? createSessionId(), context);
  saveDeepSession(next, storage);
  return next;
}

export function clearDeepSession(storage: Storage = sessionStorage) {
  storage.removeItem(DEEP_SESSION_KEY);
}
