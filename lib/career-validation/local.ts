/**
 * Same-browser recovery for the career validator flow.
 *
 * This is a convenience copy only: the server session is the source of truth.
 * Recovery is promised for the same browser profile on the same device; it is
 * never presented to the user as cross-device sync.
 */

export const VALIDATION_LOCAL_KEY = 'jianvia.career-validator.v1';

const STORAGE_UNAVAILABLE = 'VALIDATION_STORAGE_UNAVAILABLE';

export type ValidationLocalStep = 'overview' | 'task' | 'submission' | 'reflection';

export type ValidationLocalDraft = {
  content: string;
  publicResultUrl: string;
  reflection: Record<string, string>;
  notes?: string;
};

export type ValidationLocalEnvelope = {
  validationSessionId: string;
  capability: string;
  revision: number;
  step: ValidationLocalStep;
  draft: ValidationLocalDraft;
  retentionExpiresAt: string;
  updatedAt: string;
};

type ValidationLocalStore = {
  version: 1;
  sessions: Record<string, ValidationLocalEnvelope>;
};

function unavailable(): Error {
  return new Error(STORAGE_UNAVAILABLE);
}

function readStore(storage: Storage): ValidationLocalStore {
  let raw: string | null;
  try {
    raw = storage.getItem(VALIDATION_LOCAL_KEY);
  } catch {
    throw unavailable();
  }
  if (!raw) return { version: 1, sessions: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<ValidationLocalStore> | null;
    if (!parsed || parsed.version !== 1 || typeof parsed.sessions !== 'object' || parsed.sessions === null) {
      return { version: 1, sessions: {} };
    }
    const sessions: Record<string, ValidationLocalEnvelope> = {};
    for (const [id, envelope] of Object.entries(parsed.sessions)) {
      if (isEnvelope(envelope) && envelope.validationSessionId === id) sessions[id] = envelope;
    }
    return { version: 1, sessions };
  } catch {
    return { version: 1, sessions: {} };
  }
}

function isEnvelope(value: unknown): value is ValidationLocalEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ValidationLocalEnvelope>;
  return typeof candidate.validationSessionId === 'string'
    && typeof candidate.capability === 'string'
    && typeof candidate.revision === 'number'
    && typeof candidate.retentionExpiresAt === 'string'
    && (candidate.step === 'overview' || candidate.step === 'task' || candidate.step === 'submission' || candidate.step === 'reflection')
    && typeof candidate.draft === 'object' && candidate.draft !== null;
}

function isExpired(envelope: ValidationLocalEnvelope, now: number): boolean {
  const expiresAt = Date.parse(envelope.retentionExpiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

function writeStore(storage: Storage, store: ValidationLocalStore): void {
  try {
    if (Object.keys(store.sessions).length === 0) storage.removeItem(VALIDATION_LOCAL_KEY);
    else storage.setItem(VALIDATION_LOCAL_KEY, JSON.stringify(store));
  } catch {
    throw unavailable();
  }
}

export function saveValidationLocal(storage: Storage, envelope: ValidationLocalEnvelope): void {
  const now = Date.now();
  const store = readStore(storage);
  const sessions = Object.fromEntries(
    Object.entries(store.sessions).filter(([, item]) => !isExpired(item, now)),
  );
  sessions[envelope.validationSessionId] = envelope;
  writeStore(storage, { version: 1, sessions });
}

export function loadValidationLocal(storage: Storage, sessionId: string): ValidationLocalEnvelope | null {
  const now = Date.now();
  const store = readStore(storage);
  const envelope = store.sessions[sessionId];
  if (!envelope) return null;
  if (isExpired(envelope, now)) {
    delete store.sessions[sessionId];
    writeStore(storage, store);
    return null;
  }
  return envelope;
}

export function clearValidationLocal(storage: Storage, sessionId: string): void {
  const store = readStore(storage);
  if (!(sessionId in store.sessions)) return;
  delete store.sessions[sessionId];
  writeStore(storage, store);
}
