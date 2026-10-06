import { createHash } from 'node:crypto';

export const asciiCompare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const sortedUnique = <T extends string>(values: readonly T[]): T[] => [...new Set(values)].sort(asciiCompare);
const metadataKeys = new Set(['artifactHash', 'generatedAt', 'completedAt', 'duration', 'durationMs', 'uiCursor', 'rowId']);
const orderedArrays = new Set(['selectedDecisionIds', 'secondaryDecisionIds', 'decisions', 'followups', 'items', 'questions', 'options']);
const setKeys = /(?:Refs|Ids|Sources|Signals|Hypotheses|Assessments|Variants|Dependencies|limitations|Limitations|conditions|themes|Matrix|Strength|unknowns|differences|conflicts|taskPreferences|workValues|ReasonCodes)$/;

/** Only domain sets are sorted: ranked decisions and planned question order remain semantic. */
export function canonicalSemantic(value: unknown, key = ''): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value.normalize('NFC'));
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalSemantic(item));
    if (!orderedArrays.has(key) && (setKeys.test(key) || key === 'answers' || key === 'knownPillars')) items.sort(asciiCompare);
    return `[${items.join(',')}]`;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.entries(value).filter(([name]) => !metadataKeys.has(name))
      .sort(([a], [b]) => asciiCompare(a, b))
      .map(([name, item]) => `${JSON.stringify(name.normalize('NFC'))}:${canonicalSemantic(item, name)}`).join(',')}}`;
  }
  throw new Error('NON_CANONICAL_SEMANTIC_VALUE');
}
export function semanticHash(value: unknown): string {
  return createHash('sha256').update(canonicalSemantic(value)).digest('hex');
}
export function stableId(namespace: string, value: unknown): string {
  return `${namespace}:${semanticHash(value).slice(0, 24)}`;
}
