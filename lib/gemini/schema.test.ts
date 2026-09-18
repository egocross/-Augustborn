import { expect, it } from 'vitest';

import { ReportJsonSchema, parseReport } from './schema';

it('accepts a report whose section count is determined by the model', () => {
  const result = parseReport({
    sections: [{ heading: '观察', body: '内容', bullets: [] }],
    disclaimer: '仅供参考',
  });

  expect(result.sections).toHaveLength(1);
});

it('exposes an unbounded JSON schema for model-selected sections', () => {
  if (!ReportJsonSchema.properties) {
    throw new Error('Expected report JSON schema properties.');
  }

  const sections = ReportJsonSchema.properties.sections as {
    minItems?: number;
    maxItems?: number;
  };

  expect(sections.minItems).toBe(1);
  expect(sections.maxItems).toBeUndefined();
});
