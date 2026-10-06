import { Lunar, LunarMonth, Solar, SolarUtil } from 'lunar-typescript';
import { z } from 'zod';
import { hourBranch } from './chart';
import type { BirthTimeConfidence } from './signal-schema';

export const BIRTH_SUPPORT_POLICY_VERSION = 'birth-support-v2';
export const ClockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'invalid_clock_time');
export const TimeRangeSchema = z.object({
  start: ClockTimeSchema, end: ClockTimeSchema, endDayOffset: z.union([z.literal(0), z.literal(1)]),
}).strict().superRefine((range, ctx) => {
  const duration = clockMinutes(range.end) + range.endDayOffset * 1440 - clockMinutes(range.start);
  if (duration < 0) ctx.addIssue({ code: 'custom', message: 'range_end_before_start' });
  if (duration > 1440) ctx.addIssue({ code: 'custom', message: 'range_exceeds_24_hours' });
});
export type BirthTimeRange = z.infer<typeof TimeRangeSchema>;

export const BirthInputV2Schema = z.object({
  schemaVersion: z.literal('birth-input-v2'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_birth_date'),
  calendarType: z.enum(['solar', 'lunar']), isLeapMonth: z.boolean(),
  timezone: z.literal('Asia/Shanghai'), timeBasis: z.literal('standard_clock'),
  birthTime: ClockTimeSchema.nullable(), timeRange: TimeRangeSchema.nullable(),
  reportedPrecision: z.enum(['exact', 'range', 'unknown']),
  birthRegion: z.string().trim().max(40).optional(),
}).strict().superRefine((input, ctx) => {
  const issue = (message: string, path: string) => ctx.addIssue({ code: 'custom', message, path: [path] });
  const [year, month, day] = input.birthDate.split('-').map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) issue('invalid_birth_date', 'birthDate');
  else if (year < 1900 || year > 2100) issue('birth_year_out_of_range', 'birthDate');
  else if (month < 1 || month > 12 || day < 1 || day > 31) issue('invalid_birth_date', 'birthDate');
  else {
    try {
      const days = input.calendarType === 'lunar'
        ? LunarMonth.fromYm(year, input.isLeapMonth ? -month : month)?.getDayCount() ?? 0
        : month >= 1 && month <= 12 ? SolarUtil.getDaysOfMonth(year, month) : 0;
      if (month < 1 || month > 12 || day < 1 || day > days) issue('invalid_birth_date', 'birthDate');
    } catch { issue('calendar_conversion_failed', 'birthDate'); }
  }
  if (input.calendarType === 'solar' && input.isLeapMonth) issue('solar_leap_month_not_allowed', 'isLeapMonth');
  if (input.reportedPrecision === 'exact' && (input.birthTime === null || input.timeRange !== null)) issue('exact_requires_time_only', 'reportedPrecision');
  if (input.reportedPrecision === 'range' && (input.birthTime !== null || input.timeRange === null)) issue('range_requires_endpoints_only', 'reportedPrecision');
  if (input.reportedPrecision === 'unknown' && (input.birthTime !== null || input.timeRange !== null)) issue('unknown_requires_empty_time', 'reportedPrecision');
});
export type BirthInputV2 = z.infer<typeof BirthInputV2Schema>;

/** beijing_standard means the supplied DATE and clock fields are already in fixed UTC+08
 * standard time, including the whole date interval for unknown. It does NOT mean
 * a Beijing birthplace or an unexamined historical birth-certificate wall clock.
 * Unverified civil records must declare unverified/historical_unverified. V2 neither
 * infers nor converts historical DST. No browser timezone or self-conversion override.
 */
export const BirthSupportDeclarationSchema = z.object({
  reportedTimeBasis: z.enum(['beijing_standard', 'overseas_civil', 'unverified', 'historical_unverified']),
  overseasDeclared: z.boolean(),
}).strict();
export type BirthSupportDeclaration = z.infer<typeof BirthSupportDeclarationSchema>;
export const BirthSupportReasonSchema = z.enum([
  'overseas_civil_time_unsupported', 'time_basis_unverified', 'historical_time_basis_unverified',
]);
export const BirthSupportAssessmentSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('supported'), reasonCode: z.null(),
    reportedTimeBasis: z.literal('beijing_standard'), overseasDeclared: z.literal(false),
  }).strict(),
  z.object({
    status: z.literal('unavailable'), reasonCode: BirthSupportReasonSchema,
    ...BirthSupportDeclarationSchema.shape,
  }).strict(),
]).superRefine((assessment, ctx) => {
  if (assessment.status !== 'unavailable') return;
  const expected = declaredReason(assessment);
  if (assessment.reasonCode !== expected) ctx.addIssue({ code: 'custom', message: 'support_reason_mismatch' });
});
export type BirthSupportAssessment = z.infer<typeof BirthSupportAssessmentSchema>;

function declaredReason(declaration: BirthSupportDeclaration): z.infer<typeof BirthSupportReasonSchema> | null {
  if (declaration.overseasDeclared || declaration.reportedTimeBasis === 'overseas_civil') return 'overseas_civil_time_unsupported';
  if (declaration.reportedTimeBasis === 'historical_unverified') return 'historical_time_basis_unverified';
  if (declaration.reportedTimeBasis !== 'beijing_standard') return 'time_basis_unverified';
  return null;
}

export function clockMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

/** Calendar conversion only; never obtains an EightChar or uses a noon placeholder. */
export function resolveBirthSolarDate(input: BirthInputV2): Solar {
  const [year, month, day] = input.birthDate.split('-').map(Number);
  return input.calendarType === 'lunar'
    ? Lunar.fromYmdHms(year, input.isLeapMonth ? -month : month, day, 0, 0, 0).getSolar()
    : Solar.fromYmd(year, month, day);
}

/** Callers submit declarations, never a trusted assessment. Unsupported declarations short-circuit before calendar work. */
export function assessBirthSupport(rawInput: unknown, rawDeclaration: unknown): BirthSupportAssessment {
  const declaration = BirthSupportDeclarationSchema.parse(rawDeclaration);
  const reason = declaredReason(declaration);
  if (reason) return BirthSupportAssessmentSchema.parse({ ...declaration, status: 'unavailable', reasonCode: reason });
  const input = BirthInputV2Schema.parse(rawInput);
  // Validate calendar conversion, not the historical zone. A year alone says
  // nothing about whether already-standard fields require civil-time conversion.
  resolveBirthSolarDate(input);
  return BirthSupportAssessmentSchema.parse({
    ...declaration,
    status: 'supported', reasonCode: null,
  });
}

export function deriveBirthTimeConfidence(rawInput: BirthInputV2): BirthTimeConfidence {
  const input = BirthInputV2Schema.parse(rawInput);
  if (input.reportedPrecision === 'exact') return 'exact';
  if (input.reportedPrecision === 'unknown') return 'unknown';
  const range = input.timeRange!;
  const start = clockMinutes(range.start);
  const end = clockMinutes(range.end) + range.endDayOffset * 1440;
  const branches = new Set<string>();
  // At most 1441 integer minutes, including the closed right endpoint.
  for (let minute = start; minute <= end; minute++) branches.add(hourBranch(Math.floor(minute / 60) % 24));
  return branches.size === 1 ? 'approximate_same_shichen' : 'cross_shichen';
}

/** A named period becomes an explicit, user-confirmed range; never a representative birthTime. */
export function confirmedStaticTimeRange(selection: unknown): BirthTimeRange {
  z.object({ period: z.literal('afternoon'), confirmed: z.literal(true) }).strict().parse(selection);
  return { start: '12:00', end: '18:00', endDayOffset: 0 };
}

export type PreparedBirthInput =
  | { status: 'supported'; assessment: Extract<BirthSupportAssessment, { status: 'supported' }>; input: BirthInputV2; timeConfidence: BirthTimeConfidence }
  | { status: 'unavailable'; assessment: Extract<BirthSupportAssessment, { status: 'unavailable' }>; input: null; timeConfidence: null }
  | { status: 'invalid_input'; reasonCode: 'invalid_birth_input' | 'invalid_support_declaration' | 'calendar_conversion_failed' };

export function prepareBirthInput(rawInput: unknown, rawDeclaration: unknown): PreparedBirthInput {
  if (!BirthSupportDeclarationSchema.safeParse(rawDeclaration).success) return { status: 'invalid_input', reasonCode: 'invalid_support_declaration' };
  try {
    const assessment = assessBirthSupport(rawInput, rawDeclaration);
    if (assessment.status === 'unavailable') return { status: 'unavailable', assessment, input: null, timeConfidence: null };
    const input = BirthInputV2Schema.parse(rawInput);
    return { status: 'supported', assessment, input, timeConfidence: deriveBirthTimeConfidence(input) };
  } catch (error) {
    const invalidInput = error instanceof z.ZodError && !error.issues.some(issue => issue.message === 'calendar_conversion_failed');
    return { status: 'invalid_input', reasonCode: invalidInput ? 'invalid_birth_input' : 'calendar_conversion_failed' };
  }
}
