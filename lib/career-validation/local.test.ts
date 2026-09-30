import { describe, expect, it } from 'vitest';

import { clearValidationLocal, loadValidationLocal, saveValidationLocal, VALIDATION_LOCAL_KEY, type ValidationLocalEnvelope } from './local';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => { map.clear(); },
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => { map.delete(key); },
    setItem: (key, value) => { map.set(key, String(value)); },
  };
}

const first: ValidationLocalEnvelope = {
  validationSessionId: '123e4567-e89b-42d3-a456-426614174001', capability: 'signed-token', revision: 2,
  step: 'submission', draft: { content: '尚未同步的草稿', publicResultUrl: '', reflection: {} },
  retentionExpiresAt: '2099-01-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('same-browser validator recovery', () => {
  it('restores a namespaced unsynced draft after reload', () => {
    const storage = createMemoryStorage();
    saveValidationLocal(storage, first);
    expect(loadValidationLocal(storage, first.validationSessionId)).toEqual(first);
  });

  it('cleans expired data instead of restoring it', () => {
    const storage = createMemoryStorage();
    saveValidationLocal(storage, { ...first, retentionExpiresAt: '2000-01-01T00:00:00.000Z' });
    expect(loadValidationLocal(storage, first.validationSessionId)).toBeNull();
    expect(storage.getItem(VALIDATION_LOCAL_KEY) ?? '').not.toContain(first.validationSessionId);
  });

  it('deletes only the requested session', () => {
    const storage = createMemoryStorage();
    const second = { ...first, validationSessionId: '123e4567-e89b-42d3-a456-426614174002' };
    saveValidationLocal(storage, first);
    saveValidationLocal(storage, second);
    clearValidationLocal(storage, first.validationSessionId);
    expect(loadValidationLocal(storage, first.validationSessionId)).toBeNull();
    expect(loadValidationLocal(storage, second.validationSessionId)).toEqual(second);
  });

  it('surfaces unavailable storage instead of pretending recovery is guaranteed', () => {
    const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } } as unknown as Storage;
    expect(() => saveValidationLocal(storage, first)).toThrow('VALIDATION_STORAGE_UNAVAILABLE');
    expect(() => loadValidationLocal(storage, first.validationSessionId)).toThrow('VALIDATION_STORAGE_UNAVAILABLE');
  });
});
