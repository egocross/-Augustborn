import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { createInitialDeepState, loadDeepSession, saveDeepSession } from '@/lib/deep-analysis/session';
import { DeepAnalysisEntry } from './deep-analysis-entry';

const freeReport = {
  disclaimer: '仅供参考',
  sections: [{ heading: '标题', body: '正文', bullets: [] }],
};

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
});

afterEach(() => cleanup());

it('starts a fresh career calibration with the signed base report', () => {
  saveDeepSession({
    ...createInitialDeepState('previous-session', { baseReportSnapshotToken: 'old-token', freeReport }),
    step: 'questions',
    questionIndex: 4,
    answers: { career_status: { optionIds: ['career_status_first_job'] } },
  }, window.sessionStorage);

  render(<DeepAnalysisEntry freeReport={freeReport} baseReportSnapshotToken="v1.digest.signature" />);
  fireEvent.click(screen.getByRole('button', { name: '开始职业专项分析' }));

  const nextSession = loadDeepSession(window.sessionStorage);
  expect(nextSession?.step).toBe('intro');
  expect(nextSession?.questionIndex).toBe(0);
  expect(nextSession?.answers).toEqual({});
  expect(nextSession?.baseReportSnapshotToken).toBe('v1.digest.signature');
  expect(push).toHaveBeenCalledWith('/explore');
});
