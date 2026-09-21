import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { createInitialDeepState, saveDeepSession } from '@/lib/deep-analysis/session';
import { DeepAnalysisFlow } from './deep-analysis-flow';

const props = {
  birthInput: { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州' },
  freeReport: { disclaimer: '只供参考', sections: [{ heading: '性格', body: '内容', bullets: [] }] },
  price: '¥29.90',
};

afterEach(() => cleanup());

it('starts with five freely selectable exploration directions', async () => {
  render(<DeepAnalysisFlow {...props} />);
  expect(await screen.findByText('接下来，你最想进一步弄清楚什么？')).toBeTruthy();
  expect(screen.getByRole('button', { name: /我适合做什么工作/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /我有其他问题/ })).toBeTruthy();
});

it('opens the first fixed question only after choosing a direction', async () => {
  render(<DeepAnalysisFlow {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: /我适合做什么工作/ }));
  expect(screen.getByText('第 1 / 5 题')).toBeTruthy();
  expect(screen.getByText('你目前处于什么状态？')).toBeTruthy();
});

it('restores stored progress after mount instead of losing answers', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'work',
    step: 'questions',
    questionIndex: 1,
    answers: { work_q1: { optionIds: ['work_q1_student'] } },
  }, window.sessionStorage);

  render(<DeepAnalysisFlow {...props} />);
  expect(await screen.findByText('第 2 / 5 题')).toBeTruthy();
});

it('uses a direction-specific payment title', async () => {
  saveDeepSession({
    ...createInitialDeepState('session-12345678', props),
    selectedDirection: 'city',
    step: 'payment',
  }, window.sessionStorage);
  render(<DeepAnalysisFlow {...props} />);
  expect(await screen.findByText('你的城市发展深度分析已经准备好')).toBeTruthy();
});
