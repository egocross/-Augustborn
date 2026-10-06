import { describe, expect, it } from 'vitest';
import {
  assessBirthSupport, BirthInputV2Schema, BirthSupportAssessmentSchema, confirmedStaticTimeRange,
  deriveBirthTimeConfidence, prepareBirthInput, type BirthInputV2,
} from './input-v2';

const declaration = { reportedTimeBasis: 'beijing_standard', overseasDeclared: false };
const input: BirthInputV2 = {
  schemaVersion: 'birth-input-v2', birthDate: '2000-06-15', calendarType: 'solar', isLeapMonth: false,
  timezone: 'Asia/Shanghai', timeBasis: 'standard_clock', reportedPrecision: 'exact', birthTime: '13:30', timeRange: null,
};
const range = (start: string, end: string, endDayOffset: 0 | 1 = 0): BirthInputV2 => ({
  ...input, reportedPrecision: 'range', birthTime: null, timeRange: { start, end, endDayOffset },
});

describe('BirthInputV2 strict contract', () => {
  it('retains the complete declared calendar, clock and time contract', () => {
    expect(BirthInputV2Schema.parse(input)).toEqual(input);
    expect(prepareBirthInput(input, declaration)).toMatchObject({ status: 'supported', timeConfidence: 'exact', input });
  });
  it.each([
    { reportedPrecision: 'same_shichen' }, { reportedPrecision: 'cross_shichen' },
    { timeConfidence: 'exact' }, { same_shichen: true }, { timezone: 'America/New_York' },
    { timeBasis: 'true_solar' }, { birthTime: '24:00' }, { birthTime: '7:00' }, { birthTime: '13:30:01' },
    { birthTime: null }, { reportedPrecision: 'unknown' }, { reportedPrecision: 'range' },
    { timeRange: { start: '13:00', end: '14:00', endDayOffset: 0 } },
    { birthDate: '2000-02-30' }, { birthDate: '1900-02-29' }, { birthDate: '1899-12-31' },
    { birthDate: '2101-01-01' }, { birthDate: '2000-13-01' }, { isLeapMonth: true },
    { birthDate: 'garbage', calendarType: 'lunar' }, { birthDate: '2000-xx-01', calendarType: 'lunar' },
    { birthDate: '2000-00-00', calendarType: 'lunar' }, { birthDate: '2000-13-01', calendarType: 'lunar' },
    { birthRegion: '长'.repeat(41) },
  ])('rejects malformed or caller-derived fields: %j', (patch) => {
    expect(BirthInputV2Schema.safeParse({ ...input, ...patch }).success).toBe(false);
    expect(prepareBirthInput({ ...input, ...patch }, declaration).status).toBe('invalid_input');
  });
  it.each([
    { start: '22:00', end: '01:00', endDayOffset: 0 },
    { start: '22:00', end: '01:00' },
    { start: '22:00', end: '01:00', endDayOffset: -1 },
    { start: '22:00', end: '01:00', endDayOffset: 2 },
    { start: '22:00', end: '01:00', endDayOffset: '1' },
    { start: '12:00', end: '12:01', endDayOffset: 1 },
    { start: '12:00', end: '13:00', endDayOffset: 0, confidence: 'same_shichen' },
  ])('rejects invalid range instead of guessing a date: %j', (timeRange) => {
    expect(BirthInputV2Schema.safeParse({ ...range('12:00', '13:00'), timeRange }).success).toBe(false);
  });
  it('allows exactly 24 hours and a singleton range', () => {
    expect(BirthInputV2Schema.safeParse(range('12:00', '12:00', 1)).success).toBe(true);
    expect(deriveBirthTimeConfidence(range('13:00', '13:00'))).toBe('approximate_same_shichen');
  });
  it('validates lunar month lengths and leap-month existence', () => {
    expect(BirthInputV2Schema.safeParse({ ...input, calendarType: 'lunar', birthDate: '2023-02-01', isLeapMonth: true }).success).toBe(true);
    expect(BirthInputV2Schema.safeParse({ ...input, calendarType: 'lunar', birthDate: '2023-03-01', isLeapMonth: true }).success).toBe(false);
    expect(BirthInputV2Schema.safeParse({ ...input, calendarType: 'lunar', birthDate: '2023-02-30', isLeapMonth: true }).success).toBe(false);
  });
});

describe('code-derived time confidence', () => {
  it.each([
    ['13:10', '14:50', 0, 'approximate_same_shichen'],
    ['14:50', '15:10', 0, 'cross_shichen'],
    ['14:50', '15:00', 0, 'cross_shichen'],
    ['22:50', '00:10', 1, 'cross_shichen'],
    ['23:10', '00:10', 1, 'approximate_same_shichen'],
    ['00:00', '00:00', 1, 'cross_shichen'],
  ] as const)('%s–%s (+%i) => %s', (start, end, offset, confidence) => {
    expect(deriveBirthTimeConfidence(range(start, end, offset))).toBe(confidence);
  });
  it('derives unknown only from both empty time fields', () => {
    expect(deriveBirthTimeConfidence({ ...input, reportedPrecision: 'unknown', birthTime: null })).toBe('unknown');
  });
  it('requires confirmation and explicit endpoints for the static afternoon period', () => {
    expect(() => confirmedStaticTimeRange({ period: 'afternoon', confirmed: false })).toThrow();
    expect(() => confirmedStaticTimeRange({ period: 'afternoon' })).toThrow();
    expect(() => confirmedStaticTimeRange({ period: 'evening', confirmed: true })).toThrow();
    const timeRange = confirmedStaticTimeRange({ period: 'afternoon', confirmed: true });
    expect(timeRange).toEqual({ start: '12:00', end: '18:00', endDayOffset: 0 });
    expect(deriveBirthTimeConfidence({ ...input, reportedPrecision: 'range', birthTime: null, timeRange })).toBe('cross_shichen');
  });
});

describe('BirthSupportAssessment gate', () => {
  it.each([
    [{ reportedTimeBasis: 'overseas_civil', overseasDeclared: false }, 'overseas_civil_time_unsupported'],
    [{ reportedTimeBasis: 'beijing_standard', overseasDeclared: true }, 'overseas_civil_time_unsupported'],
    [{ reportedTimeBasis: 'unverified', overseasDeclared: false }, 'time_basis_unverified'],
    [{ reportedTimeBasis: 'historical_unverified', overseasDeclared: false }, 'historical_time_basis_unverified'],
  ])('assesses declared scope before constructing an input: %j', (support, reasonCode) => {
    expect(assessBirthSupport(null, support)).toEqual({ ...support, status: 'unavailable', reasonCode });
    expect(prepareBirthInput(input, support)).toMatchObject({ status: 'unavailable', input: null, timeConfidence: null });
  });
  it('does not infer domestic support from an empty region, a clock, or a timezone label', () => {
    for (const support of [{}, { reportedTimeBasis: 'beijing_standard' }, { overseasDeclared: false }]) {
      expect(prepareBirthInput(input, support)).toEqual({ status: 'invalid_input', reasonCode: 'invalid_support_declaration' });
    }
  });
  it.each(['exact', 'range', 'unknown'] as const)('cannot clear/replace an overseas time to bypass scope: %s', (precision) => {
    const value = precision === 'range' ? range('12:00', '13:00') : { ...input, reportedPrecision: precision, birthTime: precision === 'exact' ? '12:00' : null };
    expect(prepareBirthInput(value, { ...declaration, overseasDeclared: true }).status).toBe('unavailable');
  });
  it('rejects self-conversion and caller-supplied assessments', () => {
    expect(prepareBirthInput(input, { ...declaration, overseasDeclared: true, alreadyConverted: true }).status).toBe('invalid_input');
    expect(prepareBirthInput({ ...input, alreadyConverted: true }, { ...declaration, overseasDeclared: true }).status).toBe('unavailable');
    expect(prepareBirthInput(input, { ...declaration, status: 'supported', reasonCode: null }).status).toBe('invalid_input');
    expect(BirthSupportAssessmentSchema.safeParse({ ...declaration, overseasDeclared: true, status: 'supported', reasonCode: null }).success).toBe(false);
    expect(BirthSupportAssessmentSchema.safeParse({ ...declaration, overseasDeclared: true, status: 'unavailable', reasonCode: 'time_basis_unverified' }).success).toBe(false);
  });
  it.each(['1900-01-01', '1949-12-31', '1986-01-01', '1987-08-03', '1991-12-31'])('fails closed for historical civil date %s', (birthDate) => {
    expect(assessBirthSupport({ ...input, birthDate }, declaration)).toMatchObject({ status: 'unavailable', reasonCode: 'historical_time_basis_unverified' });
  });
  it('checks historical scope after lunar conversion and across the explicit end day', () => {
    expect(assessBirthSupport({ ...input, calendarType: 'lunar', birthDate: '1985-12-01' }, declaration).status).toBe('unavailable');
    expect(assessBirthSupport({ ...range('23:00', '00:00', 1), birthDate: '1985-12-31' }, declaration).status).toBe('unavailable');
    expect(assessBirthSupport({ ...input, birthDate: '1977-10-15' }, declaration).status).toBe('supported');
    expect(assessBirthSupport({ ...input, birthDate: '1992-01-01' }, declaration).status).toBe('supported');
  });
});
