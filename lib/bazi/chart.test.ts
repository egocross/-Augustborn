import { describe, expect, it } from 'vitest';
import { createChart, hourBranch } from './chart';

const completeInput = { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '浙江杭州' };

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
  it('creates four nonempty pillars from a complete birth input', () => {
    const chart = createChart(completeInput);

    expect(Object.values(chart.pillars)).toHaveLength(4);
    expect(Object.values(chart.pillars).every((pillar) => pillar?.length === 2)).toBe(true);
    expect(chart.solarDate).toBe('1977-10-15');
    expect(chart.hourBranch).toBe('未');
    expect(chart.timeKnown).toBe(true);
    expect(chart.birthRegion).toBe('浙江杭州');
  });

  it('counts the five elements across all four pillars', () => {
    expect(createChart(completeInput).fiveElements).toEqual({ 木: 1, 火: 3, 土: 2, 金: 1, 水: 1 });
  });

  it('omits the hour pillar and its elements when the birth time is unknown', () => {
    const chart = createChart({ birthDate: '1977-10-15', birthTime: null });

    expect(chart.timeKnown).toBe(false);
    expect(chart.pillars.hour).toBeNull();
    expect(chart.hourBranch).toBeNull();
    expect(chart.pillars.day).toBe(createChart(completeInput).pillars.day);
    expect(chart.fiveElements).toEqual({ 木: 1, 火: 3, 土: 1, 金: 1, 水: 0 });
  });

  it('uses Asia/Shanghai exact solar terms across the 2025 立春 boundary', () => {
    const beforeLiChun = createChart({ birthDate: '2025-02-03', birthTime: '22:00' });
    const afterLiChun = createChart({ birthDate: '2025-02-03', birthTime: '23:00' });

    expect(beforeLiChun.solarDate).toBe('2025-02-03');
    expect(beforeLiChun.pillars.year).toBe('甲辰');
    expect(beforeLiChun.pillars.month).toBe('丁丑');
    expect(afterLiChun.pillars.year).toBe('乙巳');
    expect(afterLiChun.pillars.month).toBe('戊寅');
  });

  it('derives the 23:00 hour stem from the returned civil-day day stem', () => {
    const chart = createChart({ birthDate: '2025-02-03', birthTime: '23:00' });

    expect(chart.pillars.day).toBe('癸卯');
    expect(chart.pillars.hour).toBe('壬子');
    expect(chart.hourBranch).toBe('子');
  });

  it('drops a blank birth region', () => {
    const chart = createChart({ birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '   ' });

    expect(chart.birthRegion).toBeNull();
  });
});
