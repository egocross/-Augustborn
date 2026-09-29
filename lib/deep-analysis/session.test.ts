import { describe, expect, it } from 'vitest';

import { normalizeCareerCalibration, type CareerDraftAnswers } from './career-calibration';
import {
  createInitialCareerState,
  deepFlowReducer,
  loadDeepSession,
  saveDeepSession,
  saveFreeReportContext,
  type DeepFlowState,
} from './session';

const storage = () => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } as Storage;
};

const freeReport = {
  disclaimer: '仅供参考。',
  sections: [{ heading: '核心结构', body: '基础报告正文', bullets: ['要点'] }],
};

const legacyReport = {
  title: '旧专项报告', summary: '摘要', keyFindings: ['一', '二'],
  cards: [
    { id: 'c1', title: 'A', summary: 'a', details: ['x'], evidence: [] },
    { id: 'c2', title: 'B', summary: 'b', details: ['y'], evidence: [] },
  ],
  risks: [{ title: '风险', detail: '细节', mitigation: '应对' }],
  nextActions: [
    { title: '行动一', detail: '细节', timeframe: '本周' },
    { title: '行动二', detail: '细节', timeframe: '下周' },
  ],
  reflectionQuestions: [], disclaimer: '仅参考。',
};

const completeAnswers = (): CareerDraftAnswers => ({
  career_status: { optionIds: ['career_status_first_job'] },
  transition_urgency: { optionIds: ['transition_3_months'] },
  minimum_income: { optionIds: ['minimum_income_3000_5000'] },
  salary_drop_tolerance: { optionIds: ['salary_drop_none'] },
  responsibilities: { optionIds: ['responsibility_none'] },
  location_mobility: { optionIds: ['mobility_nationwide'] },
  weekly_hours: { optionIds: ['weekly_hours_full_time'] },
  preparation_horizon: { optionIds: ['preparation_3_6_months'] },
  max_budget: { optionIds: ['budget_1000_3000'] },
  career_capital: { optionIds: ['capital_none'] },
  restart_tolerance: { optionIds: ['restart_entry_level'] },
  education_tolerance: { optionIds: ['education_systematic_training'] },
  work_constraints: { optionIds: ['work_constraint_none'] },
  income_models: { optionIds: ['income_model_any'] },
  employment_types: { optionIds: ['employment_type_any'] },
  career_values: { optionIds: ['value_growth'] },
});

describe('career session state', () => {
  it('starts at the introduction without birth input or a legacy direction', () => {
    const state = createInitialCareerState('session-123', {
      freeReport,
      baseReportSnapshotToken: 'v1.digest.signature',
    });

    expect(state).toMatchObject({
      step: 'intro', sectionIndex: 0, questionIndex: 0, answers: {},
      summaryConfirmed: false, readOnlyLegacy: false,
      baseReportSnapshotToken: 'v1.digest.signature',
    });
    expect(state).not.toHaveProperty('birthInput');
    expect(state).not.toHaveProperty('selectedDirection');
    expect(state).not.toHaveProperty('customQuestion');
  });

  it('moves through visible questions and retains answers when moving backward', () => {
    let state = createInitialCareerState('session-123', { freeReport, baseReportSnapshotToken: 'token' });
    state = deepFlowReducer(state, { type: 'beginQuestions' });
    state = deepFlowReducer(state, {
      type: 'setAnswer', questionId: 'career_status', answer: { optionIds: ['career_status_first_job'] },
    });
    state = deepFlowReducer(state, { type: 'nextQuestion' });

    expect(state).toMatchObject({ step: 'questions', sectionIndex: 0, questionIndex: 1 });
    expect(state.answers.career_status.optionIds).toEqual(['career_status_first_job']);

    state = deepFlowReducer(state, { type: 'previousQuestion' });
    expect(state).toMatchObject({ sectionIndex: 0, questionIndex: 0 });
    expect(state.answers.career_status.optionIds).toEqual(['career_status_first_job']);
  });

  it('skips a now-hidden conditional question and prunes its stale answer', () => {
    let state: DeepFlowState = {
      ...createInitialCareerState('session-123', { freeReport, baseReportSnapshotToken: 'token' }),
      step: 'questions' as const,
      sectionIndex: 1,
      questionIndex: 1,
      answers: {
        salary_drop_tolerance: { optionIds: ['salary_drop_20'] },
        income_runway: { optionIds: ['runway_6_12_months'] },
      },
    };
    state = deepFlowReducer(state, {
      type: 'setAnswer', questionId: 'salary_drop_tolerance', answer: { optionIds: ['salary_drop_none'] },
    });
    state = deepFlowReducer(state, { type: 'nextQuestion' });

    expect(state).toMatchObject({ sectionIndex: 2, questionIndex: 0 });
    expect(state.answers.income_runway).toBeUndefined();
  });

  it('confirms a normalized summary before payment', () => {
    const calibration = normalizeCareerCalibration(completeAnswers());
    const state = deepFlowReducer({
      ...createInitialCareerState('session-123', { freeReport, baseReportSnapshotToken: 'token' }),
      step: 'summary',
      answers: completeAnswers(),
    }, { type: 'confirmSummary', calibration });

    expect(state).toMatchObject({ step: 'payment', summaryConfirmed: true, calibration });
  });

  it('preserves answers, calibration, and paid receipt when generation fails', () => {
    const calibration = normalizeCareerCalibration(completeAnswers());
    const generating = {
      ...createInitialCareerState('session-123', { freeReport, baseReportSnapshotToken: 'token' }),
      step: 'generating' as const,
      answers: completeAnswers(), calibration, summaryConfirmed: true,
      paymentReceipt: 'signed-receipt',
    };
    const next = deepFlowReducer(generating, { type: 'generationFailed', code: 'timeout' });

    expect(next).toMatchObject({
      step: 'payment', answers: generating.answers, calibration,
      paymentReceipt: 'signed-receipt', summaryConfirmed: true, errorCode: 'timeout',
    });
  });
});

describe('career session persistence and migration', () => {
  it('round-trips the new career-only envelope', () => {
    const target = storage();
    const state = createInitialCareerState('session-123', { freeReport, baseReportSnapshotToken: 'token' });
    saveDeepSession(state, target);

    expect(loadDeepSession(target)).toMatchObject({ sessionId: 'session-123', step: 'intro' });
  });

  it('restores interrupted generation to a retryable paid state', () => {
    const target = storage();
    saveDeepSession({
      ...createInitialCareerState('session-123', { freeReport, baseReportSnapshotToken: 'token' }),
      step: 'generating', paymentReceipt: 'signed-receipt',
    }, target);

    expect(loadDeepSession(target)).toMatchObject({
      step: 'payment', paymentReceipt: 'signed-receipt', errorCode: 'interrupted',
    });
  });

  it('resets an unfinished draft when a fresh signed base report arrives', () => {
    const target = storage();
    saveDeepSession({
      ...createInitialCareerState('session-old', { freeReport, baseReportSnapshotToken: 'old-token' }),
      step: 'questions', answers: { career_status: { optionIds: ['career_status_first_job'] } },
    }, target);

    const next = saveFreeReportContext({
      freeReport: { ...freeReport, sections: [{ ...freeReport.sections[0], body: '新报告' }] },
      baseReportSnapshotToken: 'new-token',
    }, target);

    expect(next).toMatchObject({ step: 'intro', answers: {}, baseReportSnapshotToken: 'new-token' });
    expect(loadDeepSession(target)?.freeReport?.sections[0].body).toBe('新报告');
  });

  it('migrates only a completed v2 report into read-only report mode', () => {
    const target = storage();
    target.setItem('jianvia.deep-analysis', JSON.stringify({
      version: 2,
      state: {
        sessionId: 'legacy-session', step: 'report', report: legacyReport, lastReport: legacyReport,
        selectedDirection: 'work', answers: {},
      },
    }));

    expect(loadDeepSession(target)).toMatchObject({
      sessionId: 'legacy-session', step: 'report', report: { title: '旧专项报告' }, readOnlyLegacy: true,
      freeReport: null, baseReportSnapshotToken: null,
    });
  });

  it('keeps an unsigned v2 base report readable without reopening the old flow', () => {
    const target = storage();
    target.setItem('jianvia.deep-analysis', JSON.stringify({
      version: 2,
      state: {
        sessionId: 'legacy-session', step: 'direction', freeReport,
        birthInput: { birthDate: '1987-09-25' }, selectedDirection: null,
      },
    }));

    expect(loadDeepSession(target)).toMatchObject({
      sessionId: 'legacy-session', step: 'intro', freeReport,
      baseReportSnapshotToken: null, answers: {},
    });
  });

  it('discards v2 drafts and legacy direction state so removed flows cannot reopen', () => {
    const target = storage();
    target.setItem('jianvia.deep-analysis', JSON.stringify({
      version: 2,
      state: { sessionId: 'legacy-session', step: 'questions', selectedDirection: 'city', answers: {} },
    }));

    expect(loadDeepSession(target)).toBeNull();
  });

  it('discards corrupt and unsupported envelopes', () => {
    const target = storage();
    target.setItem('jianvia.deep-analysis', '{bad');
    expect(loadDeepSession(target)).toBeNull();
    target.setItem('jianvia.deep-analysis', JSON.stringify({ version: 1, state: {} }));
    expect(loadDeepSession(target)).toBeNull();
  });
});
