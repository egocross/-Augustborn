import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { DeepAnalysisFlow } from './deep-analysis-flow';

const props = {
  birthInput: { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州' },
  freeReport: { disclaimer: '只供参考', sections: [{ heading: '性格', body: '内容', bullets: [] }] },
  price: '¥29.90',
};

afterEach(() => cleanup());

it('starts with five freely selectable exploration directions', () => {
  render(<DeepAnalysisFlow {...props} />);
  expect(screen.getByText('接下来，你最想进一步弄清楚什么？')).toBeTruthy();
  expect(screen.getByRole('button', { name: /我适合做什么工作/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /我有其他问题/ })).toBeTruthy();
});

it('opens the first fixed question only after choosing a direction', () => {
  render(<DeepAnalysisFlow {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /我适合做什么工作/ }));
  expect(screen.getByText('第 1 / 5 题')).toBeTruthy();
  expect(screen.getByText('你目前处于什么状态？')).toBeTruthy();
});
