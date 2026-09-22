import { describe, expect, it } from 'vitest';

import { analysisSchema, feedbackSchema } from './validation';

describe('feedbackSchema', () => {
  it('rejects feedback ratings outside 1 through 5', () => {
    expect(feedbackSchema.safeParse({ rating: 6 }).success).toBe(false);
  });

  it('accepts an accuracy rating without a deep-analysis intent field', () => {
    expect(feedbackSchema.safeParse({ rating: 5 }).success).toBe(true);
  });

  it('rejects unknown feedback fields', () => {
    expect(feedbackSchema.safeParse({ rating: 5, wantsDeepAnalysis: true }).success).toBe(false);
  });
});

describe('analysisSchema', () => {
  const validInput = { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '浙江杭州' };

  it.each([
    ['a year below the supported range', { ...validInput, birthDate: '1899-12-31' }],
    ['a year above the supported range', { ...validInput, birthDate: '2101-01-01' }],
    ['an impossible date', { ...validInput, birthDate: '2025-02-30' }],
    ['a malformed date', { ...validInput, birthDate: '1977-10' }],
    ['an hour above 23', { ...validInput, birthTime: '24:00' }],
    ['a malformed time', { ...validInput, birthTime: '下午一点' }],
    ['a region over 40 characters', { ...validInput, birthRegion: '浙'.repeat(41) }],
  ])('rejects %s', (_description, input) => {
    expect(analysisSchema.safeParse(input).success).toBe(false);
  });

  it('rejects unknown analysis fields', () => {
    expect(analysisSchema.safeParse({ ...validInput, extra: true }).success).toBe(false);
  });

  it('accepts a complete birth input', () => {
    expect(analysisSchema.safeParse(validInput).success).toBe(true);
  });

  it('accepts an unknown birth time and an omitted region', () => {
    const result = analysisSchema.safeParse({ birthDate: '1977-10-15', birthTime: null });

    if (!result.success) {
      throw new Error('expected the input to be accepted');
    }

    expect(result.data).toMatchObject({ birthTime: null, birthRegion: '' });
  });
});
