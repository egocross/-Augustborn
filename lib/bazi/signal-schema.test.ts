import { semanticHash } from '../integrated-report/canonical-hash';
import { describe, expect, it } from 'vitest';
import { BaziSignalSnapshotSchema } from './signal-schema';

const unavailable = {
  kind: 'bazi-signal-v1',
  meta: {
    schemaVersion: 'bazi-signal-v1', inputHash: 'a'.repeat(64),
    generatedAt: '2026-10-06T00:00:00.000Z', generatorVersion: 'synthetic-fixture-v1',
    provider: 'deterministic', modelId: null,
    versions: { scanVersion: null, scoringVersion: null, baziPromptVersion: null,
      integrationPromptVersion: null, chartAlgorithmVersion: 'chart-v1', ontologyVersion: 'ontology-v1',
      evidencePolicyVersion: 'evidence-policy-v1', differencePolicyVersion: 'difference-policy-v1' },
    artifactHash: 'b'.repeat(64),
  },
  status: 'unavailable', unavailableReason: 'upstream_unavailable', timeConfidence: null,
  judgmentStrength: 'insufficient', chartVariants: [], variantAssessments: [], coreStructures: [],
  advantageHypotheses: [], driveHypotheses: [], workStyleHypotheses: [], taskTypeHypotheses: [],
  environmentHypotheses: [], stableSignals: [], timeSensitiveSignals: [], evidenceSources: [],
  confidenceLimitations: ['birth_structure_unavailable'], limitations: ['本次不使用出生结构'],
};

describe('BaziSignalSnapshot strict consumer contract', () => {
  it('rejects an unavailable envelope with birth evidence rather than laundering it as partial', () => {
    expect(BaziSignalSnapshotSchema.safeParse({ ...unavailable, stableSignals: ['bazi:research'] }).success).toBe(false);
  });
  it('accepts a complete empty unavailable envelope after semantic sealing', () => {
    expect(BaziSignalSnapshotSchema.safeParse({ ...unavailable, meta: { ...unavailable.meta, artifactHash: semanticHash(unavailable) } }).success).toBe(true);
  });
});
