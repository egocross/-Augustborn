import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { createInitialDeepState, loadDeepSession, saveDeepSession } from '@/lib/deep-analysis/session';
import { DeepAnalysisEntry } from './deep-analysis-entry';

const birthInput = { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州' };
const freeReport = {
  disclaimer: '仅供参考',
  sections: [{ heading: '标题', body: '正文', bullets: [] }],
};

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
});

afterEach(() => cleanup());

it('starts a new direction selection instead of resuming the previous final step', () => {
  saveDeepSession({
    ...createInitialDeepState('previous-session', { birthInput, freeReport }),
    step: 'optional-context',
    selectedDirection: 'city',
    questionIndex: 4,
    optionalContext: '上次填写的情况',
  }, window.sessionStorage);

  render(<DeepAnalysisEntry birthInput={birthInput} freeReport={freeReport} />);
  fireEvent.click(screen.getByRole('button', { name: '开始深入探索' }));

  const nextSession = loadDeepSession(window.sessionStorage);
  expect(nextSession?.step).toBe('direction');
  expect(nextSession?.selectedDirection).toBeNull();
  expect(nextSession?.questionIndex).toBe(0);
  expect(nextSession?.optionalContext).toBe('');
  expect(push).toHaveBeenCalledWith('/explore');
});
