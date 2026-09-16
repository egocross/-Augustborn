import { describe, expect, it } from 'vitest';

import { analysisSchema, feedbackSchema } from './validation';

describe('feedbackSchema', () => {
  it('rejects feedback ratings outside 1 through 5', () => {
    expect(feedbackSchema.safeParse({ rating: 6, wantsDeepAnalysis: false }).success).toBe(false);
  });

  it('rejects unknown feedback fields', () => {
    expect(
      feedbackSchema.safeParse({ rating: 5, wantsDeepAnalysis: true, birthDate: 'private' }).success,
    ).toBe(false);
  });
});

describe('analysisSchema', () => {
  const validInput = { lunarYear: 1977, lunarMonth: 9, lunarDay: 3, hour: 13, minute: 30 };

  it.each([
    ['year below the supported range', { ...validInput, lunarYear: 1899 }],
    ['year above the supported range', { ...validInput, lunarYear: 2101 }],
    ['month below 1', { ...validInput, lunarMonth: 0 }],
    ['month above 12', { ...validInput, lunarMonth: 13 }],
    ['day below 1', { ...validInput, lunarDay: 0 }],
    ['day above 30', { ...validInput, lunarDay: 31 }],
    ['hour below 0', { ...validInput, hour: -1 }],
    ['hour above 23', { ...validInput, hour: 24 }],
    ['minute below 0', { ...validInput, minute: -1 }],
    ['minute above 59', { ...validInput, minute: 60 }],
  ])('rejects a %s', (_description, input) => {
    expect(analysisSchema.safeParse(input).success).toBe(false);
  });

  it('rejects unknown analysis fields', () => {
    expect(analysisSchema.safeParse({ ...validInput, extra: true }).success).toBe(false);
  });

  it('accepts a complete bounded lunar input', () => {
    expect(analysisSchema.safeParse(validInput).success).toBe(true);
  });
});
