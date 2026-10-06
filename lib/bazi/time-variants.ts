import { z } from 'zod';
import { Solar } from 'lunar-typescript';
import { hourBranch } from './chart';
import { semanticHash, stableId } from '../integrated-report/canonical-hash';
import { HashSchema, IdSchema } from '../integrated-report/common-schema';
import { BirthTimeConfidenceSchema } from './signal-schema';
import {
  BIRTH_SUPPORT_POLICY_VERSION, BirthSupportAssessmentSchema, BirthSupportReasonSchema, clockMinutes, prepareBirthInput, resolveBirthSolarDate,
  type BirthInputV2,
} from './input-v2';
import {
  CanonicalChartSchema, CHART_ALGORITHM_VERSION, CHART_LIBRARY_VERSION,
  canonicalChartAt, solarTermOffsets, standardClockTimestamp,
} from './time-variant-calendar';

export const MAX_CHART_VARIANTS = 32;
const KnownPillarsSchema = z.array(z.enum(['year', 'month', 'day', 'hour'])).min(3).max(4);
const TimestampSchema = z.iso.datetime({ offset: true, precision: 0 }).refine(value => value.endsWith('+08:00'), 'standard_clock_offset_required');
export const ChartSegmentSchema = z.object({
  segmentId: IdSchema, start: TimestampSchema, end: TimestampSchema,
  startInclusive: z.literal(true), endInclusive: z.boolean(),
  calculationPoint: TimestampSchema, calculationPointPurpose: z.literal('segment_representative_only'),
  variantId: IdSchema, chartHash: HashSchema, knownPillars: KnownPillarsSchema,
}).strict();
export const CanonicalChartVariantSchema = z.object({
  variantId: IdSchema, chartHash: HashSchema, knownPillars: KnownPillarsSchema,
  segmentIds: z.array(IdSchema).min(1), chart: CanonicalChartSchema,
}).strict();
type ChartSegment = z.infer<typeof ChartSegmentSchema>;
type ChartVariant = z.infer<typeof CanonicalChartVariantSchema>;
const versions = {
  chartAlgorithmVersion: CHART_ALGORITHM_VERSION,
  chartLibraryVersion: CHART_LIBRARY_VERSION,
  timezone: 'Asia/Shanghai' as const, timeBasis: 'standard_clock' as const, sect: 2 as const,
};

export const CompleteChartVariantsSchema = z.object({
  status: z.literal('complete'), coverageComplete: z.literal(true),
  supportAssessment: BirthSupportAssessmentSchema,
  supportPolicyVersion: z.literal(BIRTH_SUPPORT_POLICY_VERSION),
  timeConfidence: BirthTimeConfidenceSchema,
  versions: z.object({
    chartAlgorithmVersion: z.literal(CHART_ALGORITHM_VERSION), chartLibraryVersion: z.literal(CHART_LIBRARY_VERSION),
    timezone: z.literal('Asia/Shanghai'), timeBasis: z.literal('standard_clock'), sect: z.literal(2),
  }).strict(),
  coverage: z.object({ start: TimestampSchema, end: TimestampSchema, startInclusive: z.literal(true), endInclusive: z.boolean() }).strict(),
  segments: z.array(ChartSegmentSchema).min(1),
  variants: z.array(CanonicalChartVariantSchema).min(1).max(MAX_CHART_VARIANTS),
  stablePillars: z.object({ year: z.string().nullable(), month: z.string().nullable(), day: z.string().nullable(), hour: z.string().nullable() }).strict(),
}).strict().superRefine((result, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (result.supportAssessment.status !== 'supported') issue('unsupported_enumeration');
  verifyCoverageFacts(result, issue);
  const expectedKnown = result.timeConfidence === 'unknown' ? ['year', 'month', 'day'] : ['year', 'month', 'day', 'hour'];
  const variants = new Map(result.variants.map(v => [v.variantId, v]));
  if (variants.size !== result.variants.length || new Set(result.variants.map(v => v.chartHash)).size !== variants.size) issue('duplicate_variant');
  if (new Set(result.segments.map(s => s.segmentId)).size !== result.segments.length) issue('duplicate_segment');
  result.segments.forEach((segment, index) => {
    const variant = variants.get(segment.variantId);
    const previous = result.segments[index - 1];
    if (segment.start > segment.end || (segment.start === segment.end && !segment.endInclusive)) issue('empty_segment');
    if (segment.calculationPoint !== segment.start) issue('invalid_calculation_point');
    if (segment.segmentId !== stableId('chart-segment', { start: segment.start, end: segment.end, startInclusive: true, endInclusive: segment.endInclusive, variantId: segment.variantId })) issue('segment_id_mismatch');
    if (index === 0 ? segment.start !== result.coverage.start : previous.end !== segment.start || previous.endInclusive) issue('segment_coverage_gap_or_overlap');
    if (index === result.segments.length - 1 && (segment.end !== result.coverage.end || segment.endInclusive !== result.coverage.endInclusive)) issue('segment_coverage_end_mismatch');
    if (!variant || variant.chartHash !== segment.chartHash || !variant.segmentIds.includes(segment.segmentId)) issue('segment_variant_mismatch');
    if (JSON.stringify(segment.knownPillars) !== JSON.stringify(expectedKnown)) issue('known_pillars_mismatch');
  });
  for (const variant of result.variants) {
    if (JSON.stringify(variant.knownPillars) !== JSON.stringify(expectedKnown)) issue('known_pillars_mismatch');
    if (variant.chart.timeKnown !== (result.timeConfidence !== 'unknown')) issue('time_known_mismatch');
    if (variant.chartHash !== chartHash(variant.chart)) issue('chart_hash_mismatch');
    if (variant.variantId !== stableId('chart-variant', { chartHash: variant.chartHash })) issue('variant_id_mismatch');
    const ids = result.segments.filter(s => s.variantId === variant.variantId).map(s => s.segmentId);
    if (JSON.stringify(ids) !== JSON.stringify(variant.segmentIds)) issue('variant_segment_coverage_mismatch');
  }
  for (const pillar of ['year', 'month', 'day', 'hour'] as const) {
    const values = new Set(result.variants.map(v => v.chart.pillars[pillar]));
    if (result.stablePillars[pillar] !== (values.size === 1 ? result.variants[0].chart.pillars[pillar] : null)) issue('false_stable_pillar');
  }
});
export type CompleteChartVariants = z.infer<typeof CompleteChartVariantsSchema>;
const emptyResultShape = {
  coverageComplete: z.literal(false), segments: z.tuple([]), variants: z.tuple([]), stablePillars: z.null(),
};
export const ChartVariantEnumerationSchema = z.discriminatedUnion('status', [
  CompleteChartVariantsSchema,
  z.object({
    ...emptyResultShape, status: z.literal('unavailable'), reasonCode: BirthSupportReasonSchema,
    supportAssessment: BirthSupportAssessmentSchema, timeConfidence: z.null(),
  }).strict().superRefine((result, ctx) => {
    if (result.supportAssessment.status !== 'unavailable' || result.reasonCode !== result.supportAssessment.reasonCode) ctx.addIssue({ code: 'custom', message: 'support_reason_mismatch' });
  }),
  z.object({ ...emptyResultShape, status: z.literal('invalid_input'), reasonCode: z.enum(['invalid_birth_input', 'invalid_support_declaration', 'calendar_conversion_failed']) }).strict(),
  z.object({ ...emptyResultShape, status: z.literal('sensitivity_unavailable'), reasonCode: z.enum(['variant_limit_exceeded', 'calendar_or_segment_failed']) }).strict(),
]);
export type ChartVariantEnumeration = z.infer<typeof ChartVariantEnumerationSchema>;

function chartHash(chart: z.infer<typeof CanonicalChartSchema>): string {
  // Deduplicate only by all four pillar slots (including null) and frozen algorithm.
  // No date, region, representative time or segment duration affects chart identity.
  return semanticHash({ ...versions, pillars: chart.pillars });
}

/** Revalidate serialized coverage against the frozen calendar, not caller-generated
 * hashes alone. This proves facts for the declared span, not authenticity of a birth record.
 */
function verifyCoverageFacts(result: CompleteChartVariants, issue: (message: string) => void): void {
  const { coverage, timeConfidence } = result;
  const duration = (Date.parse(coverage.end) - Date.parse(coverage.start)) / 1000;
  if (!Number.isSafeInteger(duration) || duration < 0 || duration > 86400) {
    issue('invalid_coverage_duration');
    return;
  }
  if (!coverage.start.endsWith(':00+08:00') || !coverage.end.endsWith(':00+08:00')) issue('coverage_requires_minute_endpoints');
  const known = timeConfidence !== 'unknown';
  if (known && !coverage.endInclusive) issue('known_range_requires_closed_endpoint');
  if (timeConfidence === 'exact' && duration !== 0) issue('exact_requires_singleton_coverage');
  if (!known && (duration !== 86400 || !coverage.start.endsWith('T00:00:00+08:00') || coverage.endInclusive)) issue('unknown_requires_complete_civil_day');
  try {
    const [year, month, day] = coverage.start.slice(0, 10).split('-').map(Number);
    const base = Solar.fromYmd(year, month, day);
    const midnight = Date.parse(standardClockTimestamp(base, 0));
    const offset = (stamp: string) => (Date.parse(stamp) - midnight) / 1000;
    const start = offset(coverage.start);
    const end = offset(coverage.end);
    const boundaries = new Set(solarTermOffsets(base, Math.floor(end / 86400)));
    const branches = new Set([hourBranch(Math.floor(start / 3600) % 24)]);
    for (let date = 0; date <= Math.floor(end / 86400); date++) {
      boundaries.add(date * 86400);
      for (let hour = 1; hour < 24; hour += 2) {
        const second = date * 86400 + hour * 3600;
        boundaries.add(second);
        if (second > start && second <= end) branches.add(hourBranch(hour));
      }
    }
    if (timeConfidence === 'approximate_same_shichen' && branches.size !== 1) issue('time_confidence_coverage_mismatch');
    if (timeConfidence === 'cross_shichen' && branches.size < 2) issue('time_confidence_coverage_mismatch');
    if ([...boundaries].some(second => !Number.isSafeInteger(second))) throw new Error('invalid_boundary');
    for (const segment of result.segments) {
      const first = offset(segment.start);
      const last = offset(segment.end) - (segment.endInclusive ? 0 : 1);
      if (first < start || last > end || last < first) { issue('segment_outside_coverage'); continue; }
      const probes = new Set([first, last, ...[...boundaries].filter(second => second >= first && second <= last)]);
      for (const second of probes) {
        const actual = CanonicalChartSchema.parse(canonicalChartAt(base, second, known));
        if (chartHash(actual) !== segment.chartHash) { issue('segment_calendar_facts_mismatch'); break; }
      }
    }
  } catch {
    issue('coverage_calendar_verification_failed');
  }
}

function interval(input: BirthInputV2): { start: number; end: number; endInclusive: boolean } {
  if (input.reportedPrecision === 'unknown') return { start: 0, end: 86400, endInclusive: false };
  if (input.reportedPrecision === 'exact') {
    const point = clockMinutes(input.birthTime!) * 60;
    return { start: point, end: point, endInclusive: true };
  }
  const range = input.timeRange!;
  return { start: clockMinutes(range.start) * 60, end: (clockMinutes(range.end) + range.endDayOffset * 1440) * 60, endInclusive: true };
}

/** Offline entry point. Reassesses raw declarations every time; never accepts a caller's "supported" result.
 * Segments are [start,end), with the final user range endpoint closed. Unknown covers exactly one day.
 * No partial candidate set or stability claims escape a failed enumeration.
 */
export function enumerateChartVariants(rawInput: unknown, rawDeclaration: unknown): ChartVariantEnumeration {
  const empty = { coverageComplete: false as const, segments: [] as [], variants: [] as [], stablePillars: null };
  const prepared = prepareBirthInput(rawInput, rawDeclaration);
  if (prepared.status === 'invalid_input') {
    if (prepared.reasonCode === 'calendar_conversion_failed') return { ...empty, status: 'sensitivity_unavailable', reasonCode: 'calendar_or_segment_failed' };
    return { ...empty, ...prepared };
  }
  if (prepared.status === 'unavailable') {
    return { ...empty, status: 'unavailable', reasonCode: prepared.assessment.reasonCode, supportAssessment: prepared.assessment, timeConfidence: null };
  }
  try {
    const { input, timeConfidence } = prepared;
    const base = resolveBirthSolarDate(input);
    const span = interval(input);
    const boundaries = new Set<number>([span.start]);
    // Include 23:00 even for unknown: preserve the existing sect=2 day rule, checking its facts.
    for (let day = 0; day <= Math.floor(span.end / 86400); day++) {
      boundaries.add(day * 86400);
      for (let hour = 1; hour < 24; hour += 2) boundaries.add(day * 86400 + hour * 3600);
    }
    for (const second of solarTermOffsets(base, Math.floor(span.end / 86400))) {
      if (!Number.isSafeInteger(second)) throw new Error('invalid_solar_term_offset');
      boundaries.add(second);
    }
    const starts = [...boundaries].filter(s => s >= span.start && (s < span.end || (span.endInclusive && s === span.end))).sort((a, b) => a - b);
    const segments: ChartSegment[] = [];
    const variants = new Map<string, ChartVariant>();
    for (let index = 0; index < starts.length; index++) {
      const start = starts[index];
      const end = starts[index + 1] ?? span.end;
      const endInclusive = index === starts.length - 1 && span.endInclusive;
      const chart = CanonicalChartSchema.parse(canonicalChartAt(base, start, timeConfidence !== 'unknown'));
      if (chart.timeKnown !== (timeConfidence !== 'unknown')) throw new Error('unknown_hour_leak');
      const hash = chartHash(chart);
      // Verify both ends in addition to enumerating every boundary; fail closed on inconsistency.
      const lastSecond = endInclusive ? end : end - 1;
      if (lastSecond > start && chartHash(CanonicalChartSchema.parse(canonicalChartAt(base, lastSecond, timeConfidence !== 'unknown'))) !== hash) throw new Error('segment_not_constant');
      const variantId = stableId('chart-variant', { chartHash: hash });
      const knownPillars: ChartVariant['knownPillars'] = timeConfidence === 'unknown' ? ['year', 'month', 'day'] : ['year', 'month', 'day', 'hour'];
      const segmentSpan = { start: standardClockTimestamp(base, start), end: standardClockTimestamp(base, end), startInclusive: true as const, endInclusive };
      const segmentId = stableId('chart-segment', { ...segmentSpan, variantId });
      segments.push({ ...segmentSpan, segmentId, variantId, chartHash: hash, knownPillars: [...knownPillars], calculationPoint: segmentSpan.start, calculationPointPurpose: 'segment_representative_only' });
      const existing = variants.get(hash);
      if (existing) existing.segmentIds.push(segmentId);
      else variants.set(hash, { variantId, chartHash: hash, knownPillars: [...knownPillars], segmentIds: [segmentId], chart });
      if (variants.size > MAX_CHART_VARIANTS) return { ...empty, status: 'sensitivity_unavailable', reasonCode: 'variant_limit_exceeded' };
    }
    const candidates = [...variants.values()];
    const stablePillars: CompleteChartVariants['stablePillars'] = { year: null, month: null, day: null, hour: null };
    for (const pillar of ['year', 'month', 'day', 'hour'] as const) {
      if (new Set(candidates.map(v => v.chart.pillars[pillar])).size === 1) stablePillars[pillar] = candidates[0].chart.pillars[pillar];
    }
    return CompleteChartVariantsSchema.parse({
      status: 'complete', coverageComplete: true, supportAssessment: prepared.assessment, supportPolicyVersion: BIRTH_SUPPORT_POLICY_VERSION, timeConfidence, versions,
      coverage: { start: standardClockTimestamp(base, span.start), end: standardClockTimestamp(base, span.end), startInclusive: true, endInclusive: span.endInclusive },
      segments, variants: candidates, stablePillars,
    });
  } catch {
    return { ...empty, status: 'sensitivity_unavailable', reasonCode: 'calendar_or_segment_failed' };
  }
}
