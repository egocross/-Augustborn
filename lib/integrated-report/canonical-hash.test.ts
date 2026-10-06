import { describe, expect, it } from 'vitest';
import { canonicalSemantic, semanticHash } from './canonical-hash';

describe('semantic canonicalization', () => {
  it('ignores metadata, normalizes Unicode/keys and treats evidence refs as a set', () => {
    expect(semanticHash({ b: 'e\u0301', a: 1, evidenceRefs: ['b','a'], generatedAt: 'a' }))
      .toBe(semanticHash({ evidenceRefs: ['a','b'], a: 1, b: 'é', generatedAt: 'b' }));
  });
  it('preserves decision ordering and explicit nulls', () => {
    expect(semanticHash({ selectedDecisionIds: ['a','b'] })).not.toBe(semanticHash({ selectedDecisionIds: ['b','a'] }));
    expect(canonicalSemantic({ a: null })).not.toBe(canonicalSemantic({}));
  });
  it('rejects non-JSON numbers and undefined instead of silently hashing lossy inputs', () => {
    expect(() => semanticHash({ a: NaN })).toThrow();
    expect(() => semanticHash({ a: undefined })).toThrow();
  });
});
