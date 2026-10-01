import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CareerReportSchema } from '@/lib/deep-analysis/types';

import { toGeminiResponseSchema } from './json-schema';

describe('toGeminiResponseSchema', () => {
  it('drops the array length constraints rejected by the API while keeping the structure', () => {
    const schema = toGeminiResponseSchema(CareerReportSchema) as {
      properties: Record<string, { type?: string }>;
    };
    const serialized = JSON.stringify(schema);
    expect(serialized).not.toContain('minItems');
    expect(serialized).not.toContain('maxItems');
    expect(schema.properties.careerHypotheses.type).toBe('array');
    expect(serialized).toContain('careerHypotheses');
    expect(serialized).toContain('required');
  });

  it('keeps every other constraint untouched', () => {
    const schema = toGeminiResponseSchema(z.object({ title: z.string().min(2).max(4) })) as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(schema.properties.title).toMatchObject({ type: 'string', minLength: 2, maxLength: 4 });
  });

  it('rewrites the OpenAPI exclusive bounds into numeric ones', () => {
    const schema = toGeminiResponseSchema(z.object({
      minutes: z.number().int().positive().max(10080),
      percentage: z.number().lt(1),
    })) as { properties: Record<string, Record<string, unknown>> };
    expect(schema.properties.minutes).toMatchObject({ type: 'integer', exclusiveMinimum: 0, maximum: 10080 });
    expect(schema.properties.minutes.minimum).toBeUndefined();
    expect(schema.properties.percentage.exclusiveMaximum).toBe(1);
  });

  it('moves array length rules into the description', () => {
    const schema = toGeminiResponseSchema(z.object({
      items: z.array(z.string()).min(3).max(6).describe('候选方向'),
    })) as { properties: Record<string, Record<string, unknown>> };
    expect(schema.properties.items).not.toHaveProperty('minItems');
    expect(schema.properties.items.description).toBe('候选方向；至少 3 项、最多 6 项。');
  });
});
