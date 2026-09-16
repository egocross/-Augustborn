import { describe, expect, it } from 'vitest';
import { createChart, hourBranch } from './chart';

describe('hourBranch', () => {
  it('maps 13:00 and 14:59 to 未', () => {
    expect(hourBranch(13)).toBe('未');
    expect(hourBranch(14)).toBe('未');
  });

  it('switches to 申 at 15:00', () => {
    expect(hourBranch(15)).toBe('申');
  });
});

describe('createChart', () => {
  it('creates four nonempty pillars from a valid lunar birth input', () => {
    const chart = createChart({
      lunarYear: 1977,
      lunarMonth: 9,
      lunarDay: 3,
      hour: 13,
      minute: 30,
    });

    expect(Object.values(chart.pillars)).toHaveLength(4);
    expect(Object.values(chart.pillars).every((pillar) => pillar.length === 2)).toBe(true);
    expect(chart.hourBranch).toBe('未');
  });

  it('counts the five elements across all four pillars', () => {
    const chart = createChart({
      lunarYear: 1977,
      lunarMonth: 9,
      lunarDay: 3,
      hour: 13,
      minute: 30,
    });

    expect(chart.fiveElements).toEqual({ 木: 1, 火: 3, 土: 2, 金: 1, 水: 1 });
  });
});
