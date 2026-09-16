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

  it('uses Asia/Shanghai exact solar terms across the 2025 立春 boundary', () => {
    const beforeLiChun = createChart({
      lunarYear: 2025,
      lunarMonth: 1,
      lunarDay: 6,
      hour: 22,
      minute: 0,
    });
    const afterLiChun = createChart({
      lunarYear: 2025,
      lunarMonth: 1,
      lunarDay: 6,
      hour: 23,
      minute: 0,
    });

    expect(beforeLiChun.solarDate).toBe('2025-02-03');
    expect(beforeLiChun.pillars.year).toBe('甲辰');
    expect(beforeLiChun.pillars.month).toBe('丁丑');
    expect(afterLiChun.solarDate).toBe('2025-02-03');
    expect(afterLiChun.pillars.year).toBe('乙巳');
    expect(afterLiChun.pillars.month).toBe('戊寅');
  });
});
