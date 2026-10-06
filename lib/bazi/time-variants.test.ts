import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lunar, LunarUtil, Solar } from 'lunar-typescript';
import { readFileSync } from 'node:fs';
import { createChart } from './chart';
import { BirthInputV2Schema, type BirthInputV2 } from './input-v2';
import { ChartVariantReferenceSchema } from './signal-schema';
import { ChartVariantEnumerationSchema, enumerateChartVariants, MAX_CHART_VARIANTS } from './time-variants';
import * as calendar from './time-variant-calendar';

const support = { reportedTimeBasis: 'beijing_standard', overseasDeclared: false };
const input: BirthInputV2 = {
  schemaVersion: 'birth-input-v2', birthDate: '2000-06-15', calendarType: 'solar', isLeapMonth: false,
  timezone: 'Asia/Shanghai', timeBasis: 'standard_clock', reportedPrecision: 'exact', birthTime: '13:30', timeRange: null,
};
const range = (start: string, end: string, endDayOffset: 0 | 1 = 0): BirthInputV2 => ({ ...input, reportedPrecision: 'range', birthTime: null, timeRange: { start, end, endDayOffset } });
const unknown = (birthDate = input.birthDate): BirthInputV2 => ({ ...input, birthDate, reportedPrecision: 'unknown', birthTime: null });
function complete(value: BirthInputV2) {
  const result = enumerateChartVariants(value, support);
  expect(result.status).toBe('complete');
  if (result.status !== 'complete') throw new Error(JSON.stringify(result));
  return result;
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
afterEach(() => vi.restoreAllMocks());

describe('deterministic chart variants', () => {
  it('records the installed library version and requires review on dependency upgrades', () => {
    const pkg = JSON.parse(readFileSync('node_modules/lunar-typescript/package.json', 'utf8'));
    expect(calendar.CHART_LIBRARY_VERSION).toBe(`lunar-typescript@${pkg.version}`);
  });
  it('matches the legacy exact chart and emits one closed singleton segment', () => {
    const result = complete(input);
    const original = createChart(input);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].chart).toEqual({ pillars: original.pillars, hourBranch: original.hourBranch, surfaceFiveElements: original.surfaceFiveElements, timeKnown: true });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({ start: '2000-06-15T13:30:00+08:00', end: '2000-06-15T13:30:00+08:00', endInclusive: true, calculationPointPurpose: 'segment_representative_only' });
    expect(result.versions).toMatchObject({ sect: 2, chartLibraryVersion: 'lunar-typescript@1.8.6' });
  });
  it('has the same immutable pillars throughout an ordinary same-shichen range', () => {
    const result = complete(range('13:10', '14:50'));
    expect(result.timeConfidence).toBe('approximate_same_shichen');
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].chart.hourBranch).toBe('未');
    expect(result.stablePillars).toEqual(result.variants[0].chart.pillars);
  });
  it.each(['15:00', '15:10'])('includes the new shichen when the closed range ends at %s', (end) => {
    const result = complete(range('14:50', end));
    expect(result.timeConfidence).toBe('cross_shichen');
    expect(result.variants.map(v => v.chart.hourBranch)).toEqual(['未', '申']);
    expect(result.segments[0].end).toBe('2000-06-15T15:00:00+08:00');
    expect(result.segments[0].endInclusive).toBe(false);
    expect(result.segments[1].start).toBe(result.segments[0].end);
    expect(result.segments[1].endInclusive).toBe(true);
    expect(result.stablePillars.hour).toBeNull();
  });
  it('covers 22:50 through next-day 00:10, retaining the sect=2 day at 23:00', () => {
    const result = complete(range('22:50', '00:10', 1));
    expect(result.variants).toHaveLength(3);
    expect(result.variants.map(v => v.chart.hourBranch)).toEqual(['亥', '子', '子']);
    expect(result.variants[0].chart.pillars.day).toBe(result.variants[1].chart.pillars.day);
    expect(result.variants[2].chart.pillars.day).not.toBe(result.variants[1].chart.pillars.day);
    expect(result.segments.map(s => s.start)).toEqual(['2000-06-15T22:50:00+08:00', '2000-06-15T23:00:00+08:00', '2000-06-16T00:00:00+08:00']);
    expect(result.stablePillars.day).toBeNull();
  });
  it('does not equate same shichen across midnight with a stable complete chart', () => {
    const result = complete(range('23:10', '00:10', 1));
    expect(result.timeConfidence).toBe('approximate_same_shichen');
    expect(result.variants).toHaveLength(2);
    expect(result.stablePillars.day).toBeNull();
    expect(result.stablePillars.hour).toBeNull();
  });
  it('covers a full closed 24-hour range including next-day endpoint', () => {
    const result = complete(range('00:00', '00:00', 1));
    expect(result.segments.at(-1)).toMatchObject({ start: '2000-06-16T00:00:00+08:00', end: '2000-06-16T00:00:00+08:00', endInclusive: true });
    expect(result.variants).toHaveLength(13);
    expect(result.stablePillars.day).toBeNull();
  });
  it('deduplicates the two 子 segments with the same complete pillars while retaining both references', () => {
    const result = complete(range('00:00', '23:59'));
    expect(result.segments).toHaveLength(13);
    expect(result.variants).toHaveLength(12);
    expect(result.segments[0].variantId).toBe(result.segments.at(-1)?.variantId);
    expect(result.variants[0].segmentIds).toEqual([result.segments[0].segmentId, result.segments.at(-1)?.segmentId]);
    for (const variant of result.variants) {
      expect(ChartVariantReferenceSchema.safeParse({ variantId: variant.variantId, chartHash: variant.chartHash, restrictedSegmentId: null, knownPillars: variant.knownPillars }).success).toBe(true);
    }
  });
  it('converts lunar input and keeps leap-month semantics in the validated input', () => {
    const normal = { ...input, birthDate: '2023-02-01', calendarType: 'lunar' as const };
    const leap = { ...normal, isLeapMonth: true };
    expect(BirthInputV2Schema.parse(leap).isLeapMonth).toBe(true);
    expect(complete(normal).coverage.start.slice(0, 10)).toBe('2023-02-20');
    expect(complete(leap).coverage.start.slice(0, 10)).toBe('2023-03-22');
    expect(complete(leap).variants[0].chart.pillars).toEqual(createChart(leap).pillars);
    expect(complete(leap).variants[0].chartHash).toBe(complete({ ...input, birthDate: '2023-03-22' }).variants[0].chartHash);
  });
  it('crosses from the last lunar leap-month day to the correct solar next day', () => {
    const result = complete({ ...range('23:50', '00:10', 1), calendarType: 'lunar', birthDate: '2023-02-29', isLeapMonth: true });
    expect(result.coverage).toMatchObject({ start: '2023-04-19T23:50:00+08:00', end: '2023-04-20T00:10:00+08:00' });
  });
});

describe('unknown time and second-accurate solar terms', () => {
  it('checks all ordinary-day segments, deduplicates to a partial chart, and never creates an hour', () => {
    const spy = vi.spyOn(calendar, 'canonicalChartAt');
    const result = complete(unknown());
    expect(result.segments).toHaveLength(13);
    expect(result.variants).toHaveLength(1);
    expect(result.coverage).toMatchObject({ start: '2000-06-15T00:00:00+08:00', end: '2000-06-16T00:00:00+08:00', endInclusive: false });
    expect(spy.mock.calls.every(call => call[2] === false)).toBe(true);
    expect(result.variants[0].chart).toMatchObject({ timeKnown: false, pillars: { hour: null }, hourBranch: null });
    expect(Object.values(result.variants[0].chart.surfaceFiveElements).reduce((a, b) => a + b, 0)).toBe(6);
    expect(result.stablePillars.hour).toBeNull();
    expect(result.variants[0].knownPillars).toEqual(['year', 'month', 'day']);
  });
  it('does not promote the legacy unknown/noon chart to stable year or month on 立春', () => {
    const value = unknown('2025-02-03');
    const noonPlaceholder = createChart(value);
    const result = complete(value);
    expect(result.variants).toHaveLength(2);
    expect(result.variants.map(v => v.chart.pillars.year)).toEqual(['甲辰', '乙巳']);
    expect(result.variants.map(v => v.chart.pillars.month)).toEqual(['丁丑', '戊寅']);
    expect(result.variants.some(v => v.chart.pillars.year !== noonPlaceholder.pillars.year)).toBe(true);
    expect(result.stablePillars).toEqual({ year: null, month: null, day: '癸卯', hour: null });
    expect(result.variants.every(v => v.chart.pillars.hour === null && v.chart.hourBranch === null && !v.knownPillars.includes('hour'))).toBe(true);
  });
  it('splits 立春 inside a single shichen at the actual second rather than rounding to a minute', () => {
    const term = Solar.fromYmd(2025, 2, 3).getLunar().getJieQiTable()['立春'];
    expect(term.toYmdHms()).toBe('2025-02-03 22:10:28');
    const result = complete({ ...range('22:10', '22:11'), birthDate: '2025-02-03' });
    expect(result.timeConfidence).toBe('approximate_same_shichen');
    expect(result.variants).toHaveLength(2);
    expect(result.segments.map(s => s.start)).toEqual(['2025-02-03T22:10:00+08:00', '2025-02-03T22:10:28+08:00']);
    expect(result.stablePillars.year).toBeNull();
    expect(result.stablePillars.month).toBeNull();
    expect(complete({ ...input, birthDate: '2025-02-03', birthTime: '22:10' }).variants[0].chart.pillars.year).toBe('甲辰');
    expect(complete({ ...input, birthDate: '2025-02-03', birthTime: '22:11' }).variants[0].chart.pillars.year).toBe('乙巳');
  });
  it('retains both possible months on unknown 惊蛰 without inventing an hour', () => {
    const table = Solar.fromYmd(2025, 3, 5).getLunar().getJieQiTable();
    const result = complete(unknown(table['惊蛰'].toYmd()));
    expect(result.variants).toHaveLength(2);
    expect(result.stablePillars.year).toBe('乙巳');
    expect(result.stablePillars.month).toBeNull();
    expect(result.variants.every(v => v.chart.pillars.hour === null && v.chart.hourBranch === null)).toBe(true);
  });
  it('covers all twelve year/month term days in a year, including lunar-equivalent inputs', () => {
    const table = Solar.fromYmd(2025, 6, 15).getLunar().getJieQiTable();
    const terms = LunarUtil.JIE_QI_IN_USE.filter((_, index) => index % 2 === 0).map(key => table[key]).filter(term => term.getYear() === 2025);
    expect(terms).toHaveLength(12);
    for (const term of terms) {
      const result = complete(unknown(term.toYmd()));
      expect(result.variants).toHaveLength(2);
      expect(result.stablePillars.month).toBeNull();
      const lunar = term.getLunar();
      const lunarValue = { ...unknown(), calendarType: 'lunar' as const, birthDate: `${lunar.getYear()}-${String(Math.abs(lunar.getMonth())).padStart(2, '0')}-${String(lunar.getDay()).padStart(2, '0')}`, isLeapMonth: lunar.getMonth() < 0 };
      expect(complete(lunarValue)).toEqual(result);
    }
  });
});

describe('completeness, failure closure and determinism', () => {
  it.each([
    { ...support, overseasDeclared: true },
    { ...support, reportedTimeBasis: 'overseas_civil' },
    { ...support, reportedTimeBasis: 'unverified' },
    { ...support, reportedTimeBasis: 'historical_unverified' },
  ])('never calls chart calculation or term enumeration for unsupported input: %j', (declaration) => {
    const chart = vi.spyOn(calendar, 'canonicalChartAt');
    const terms = vi.spyOn(calendar, 'solarTermOffsets');
    for (const value of [input, { ...input, birthTime: '12:00' }, unknown(), range('12:00', '13:00')]) {
      expect(enumerateChartVariants(value, declaration)).toMatchObject({ status: 'unavailable', variants: [], segments: [], stablePillars: null, timeConfidence: null, coverageComplete: false });
    }
    expect(chart).not.toHaveBeenCalled();
    expect(terms).not.toHaveBeenCalled();
  });
  it('rejects invalid input before enumerating', () => {
    const chart = vi.spyOn(calendar, 'canonicalChartAt');
    expect(enumerateChartVariants(range('22:00', '01:00'), support)).toMatchObject({ status: 'invalid_input', variants: [] });
    expect(chart).not.toHaveBeenCalled();
  });
  it('drops every candidate when any necessary segment fails, even if earlier segments succeeded', () => {
    const original = calendar.canonicalChartAt;
    vi.spyOn(calendar, 'canonicalChartAt').mockImplementation((base, seconds, known) => {
      if (seconds >= 15 * 3600) throw new Error('synthetic segment failure');
      return original(base, seconds, known);
    });
    expect(enumerateChartVariants(range('14:50', '15:10'), support)).toEqual({ status: 'sensitivity_unavailable', reasonCode: 'calendar_or_segment_failed', coverageComplete: false, segments: [], variants: [], stablePillars: null });
    expect(enumerateChartVariants(unknown(), support)).toEqual({ status: 'sensitivity_unavailable', reasonCode: 'calendar_or_segment_failed', coverageComplete: false, segments: [], variants: [], stablePillars: null });
  });
  it('fails closed on missing term tables and on invalid chart facts', () => {
    vi.spyOn(calendar, 'solarTermOffsets').mockImplementation(() => { throw new Error('missing terms'); });
    expect(enumerateChartVariants(unknown(), support).status).toBe('sensitivity_unavailable');
    vi.restoreAllMocks();
    const invalid = { ...calendar.canonicalChartAt(Solar.fromYmd(2000, 6, 15), 0, false), hourBranch: '子' };
    vi.spyOn(calendar, 'canonicalChartAt').mockReturnValue(invalid);
    expect(enumerateChartVariants(unknown(), support).status).toBe('sensitivity_unavailable');
  });
  it('returns sensitivity_unavailable if the initial lunar calendar conversion fails', () => {
    vi.spyOn(Lunar, 'fromYmdHms').mockImplementation(() => { throw new Error('synthetic calendar failure'); });
    expect(enumerateChartVariants({ ...input, calendarType: 'lunar', birthDate: '2023-02-01' }, support)).toEqual({
      status: 'sensitivity_unavailable', reasonCode: 'calendar_or_segment_failed', coverageComplete: false, segments: [], variants: [], stablePillars: null,
    });
  });
  it('returns sensitivity_unavailable if an actual library term table is incomplete', () => {
    vi.spyOn(Lunar.prototype, 'getJieQiTable').mockReturnValue({});
    expect(enumerateChartVariants(unknown('2025-02-03'), support).status).toBe('sensitivity_unavailable');
  });
  it('covers every minute and each exact term boundary with the corresponding canonical facts', () => {
    const result = complete({ ...range('21:50', '00:10', 1), birthDate: '2025-02-03' });
    const base = Solar.fromYmd(2025, 2, 3);
    const offsets = [...Array.from({ length: 141 }, (_, i) => (21 * 60 + 50 + i) * 60), ...calendar.solarTermOffsets(base, 1).filter(s => s >= 21 * 3600 && s <= 86400)];
    for (const second of offsets) {
      const stamp = calendar.standardClockTimestamp(base, second);
      const containing = result.segments.filter(segment => stamp >= segment.start && (stamp < segment.end || (segment.endInclusive && stamp === segment.end)));
      expect(containing).toHaveLength(1);
      const variant = result.variants.find(candidate => candidate.variantId === containing[0].variantId)!;
      expect(variant.chart).toEqual(calendar.canonicalChartAt(base, second, true));
    }
  });
  it('detects a missing necessary split instead of claiming a segment is constant', () => {
    vi.spyOn(calendar, 'solarTermOffsets').mockReturnValue([]);
    expect(enumerateChartVariants({ ...range('22:10', '22:11'), birthDate: '2025-02-03' }, support).status).toBe('sensitivity_unavailable');
  });
  it('fails the entire result at 33 unique variants; never offers a truncated stable set', () => {
    expect(MAX_CHART_VARIANTS).toBe(32);
    // Synthetic calendar facts exercise an otherwise unreachable defensive cap in a <=24h real range.
    vi.spyOn(calendar, 'solarTermOffsets').mockReturnValue(Array.from({ length: 32 }, (_, i) => (i + 1) * 60));
    const original = calendar.canonicalChartAt;
    vi.spyOn(calendar, 'canonicalChartAt').mockImplementation((_base, seconds, known) => {
      const index = Math.floor(seconds / 60);
      return original(Solar.fromYmd(2000 + index, 6, 15), 0, known);
    });
    expect(enumerateChartVariants(range('00:00', '00:32'), support)).toEqual({ status: 'sensitivity_unavailable', reasonCode: 'variant_limit_exceeded', coverageComplete: false, segments: [], variants: [], stablePillars: null });
    expect(complete(range('00:00', '00:31')).variants).toHaveLength(32);
  });
  it('rejects omitted/overlapping segments, wrong references, forged stability and unknown hour leaks', () => {
    const good = complete(unknown('2025-02-03'));
    const bad = structuredClone(good);
    bad.segments.splice(1, 1);
    expect(ChartVariantEnumerationSchema.safeParse(bad).success).toBe(false);
    const overlap = structuredClone(good);
    overlap.segments[0].endInclusive = true;
    expect(ChartVariantEnumerationSchema.safeParse(overlap).success).toBe(false);
    const forged = structuredClone(good);
    forged.stablePillars.year = good.variants[0].chart.pillars.year;
    expect(ChartVariantEnumerationSchema.safeParse(forged).success).toBe(false);
    const missing = structuredClone(good);
    missing.variants[0].segmentIds.pop();
    expect(ChartVariantEnumerationSchema.safeParse(missing).success).toBe(false);
    const leaked = structuredClone(good);
    leaked.variants[0].chart.pillars.hour = '甲子';
    leaked.variants[0].chart.hourBranch = '子';
    expect(ChartVariantEnumerationSchema.safeParse(leaked).success).toBe(false);
    const failure = enumerateChartVariants(input, { ...support, overseasDeclared: true });
    expect(ChartVariantEnumerationSchema.safeParse(failure).success).toBe(true);
    expect(ChartVariantEnumerationSchema.safeParse({ ...failure, variants: good.variants }).success).toBe(false);
    expect(ChartVariantEnumerationSchema.safeParse({ ...failure, stablePillars: good.stablePillars }).success).toBe(false);
  });
  it('does not mutate input and is byte-for-byte deterministic without clock, randomness or network', () => {
    const value = freezeDeep({ ...range('22:50', '00:10', 1), birthDate: '2025-02-03', birthRegion: ' 杭州 ' });
    const declaration = freezeDeep({ ...support });
    const before = JSON.stringify(value);
    const fail = () => { throw new Error('forbidden nondeterministic operation'); };
    vi.spyOn(Date, 'now').mockImplementation(fail);
    vi.spyOn(Math, 'random').mockImplementation(fail);
    vi.spyOn(globalThis, 'fetch').mockImplementation(fail);
    const first = enumerateChartVariants(value, declaration);
    expect(first.status).toBe('complete');
    expect(JSON.stringify(enumerateChartVariants(value, declaration))).toBe(JSON.stringify(first));
    expect(JSON.stringify(enumerateChartVariants(Object.fromEntries(Object.entries(value).reverse()), declaration))).toBe(JSON.stringify(first));
    expect(JSON.stringify(value)).toBe(before);
  });
});
