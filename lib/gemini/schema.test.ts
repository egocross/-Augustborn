import { expect, it } from 'vitest';

import { parseReport } from './schema';

it('accepts a report whose section count is determined by the model', () => {
  const result = parseReport({
    sections: [{ heading: '观察', body: '内容', bullets: [] }],
    disclaimer: '仅供参考',
  });

  expect(result.sections).toHaveLength(1);
});

it('rejects a report without sections', () => {
  expect(() => parseReport({ sections: [], disclaimer: '仅供参考' })).toThrow();
});
