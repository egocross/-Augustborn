import { describe, expect, it } from 'vitest';
import { AdvantageScanSignalSnapshotSchema, validateAdvantageScanSnapshot } from '../lib/advantage-scan/schema';
import { buildAdvantageScanSnapshot } from '../lib/advantage-scan/snapshot';
import { planFollowups } from '../lib/advantage-scan/followup-selector';
import { BaziSignalSnapshotSchema, type BaziSignalSnapshot } from '../lib/bazi/signal-schema';
import { semanticHash } from '../lib/integrated-report/canonical-hash';
import { buildIntegratedReasoningCore } from '../lib/integrated-report/reasoning-core';
import { validateIntegratedReasoningCore } from '../lib/integrated-report/core-schema';
import { DifferenceSchema } from '../lib/integrated-report/differences';
import { syntheticBazi } from './fixtures/integrated-advantage/synthetic-bazi';
import { goldenAnswers, GOLDEN_SCAN_VERSION, GOLDEN_GENERATED_AT } from './fixtures/integrated-advantage/answers';

function scanFor(id: string) {
  const f = goldenAnswers(id), fixed = { scanVersion: GOLDEN_SCAN_VERSION, answers: f.answers };
  return buildAdvantageScanSnapshot(f.status === 'skipped' ? { status: 'skipped', scanVersion: GOLDEN_SCAN_VERSION } : {
    status: 'completed', ...fixed, followups: { fixedInputHash: planFollowups(fixed).fixedInputHash, answers: f.followupAnswers, endedByUser: f.endedByUser },
  }, GOLDEN_GENERATED_AT);
}
function reseal<T extends { meta: { artifactHash: string } }>(value: T): T {
  return { ...value, meta: { ...value.meta, artifactHash: semanticHash(value) } };
}

describe('Phase 1 independent audit: strict scan consumption', () => {
  it('rejects none with false recall in both duplicate fields', () => {
    const scan = scanFor('G36');
    scan.scanResult!.recentRecallMissing = false;
    scan.uncertainty.recentRecallMissing = false;
    expect(AdvantageScanSignalSnapshotSchema.safeParse(reseal(scan)).success).toBe(false);
  });
  it.each(['strength', 'source', 'count', 'followup', 'hash'])('rejects forged %s even when its shape is valid', mutation => {
    const scan = scanFor('G30');
    if (mutation === 'strength') scan.derivedAdvantageHypotheses[0].strength = 'moderate';
    if (mutation === 'source') scan.evidenceSources[0].optionId = 'Q8.investigate';
    if (mutation === 'count') scan.behaviorSignals[0].raw = 3;
    if (mutation === 'followup') scan.scanResult!.followups = scanFor('G21').scanResult!.followups;
    const forged = reseal(scan);
    if (mutation === 'hash') forged.meta.artifactHash = 'a'.repeat(64);
    expect(() => validateAdvantageScanSnapshot(forged)).toThrow();
    expect(() => buildIntegratedReasoningCore({ scan: forged, bazi: syntheticBazi().snapshot }, GOLDEN_GENERATED_AT)).toThrow();
  });
});

describe('Phase 1 independent audit: birth consumption', () => {
  it('seals different synthetic birth contents with distinct real hashes', () => {
    const a = syntheticBazi({ stableThemes: ['analysis_research'] }).snapshot;
    const b = syntheticBazi({ stableThemes: ['creative_expression'] }).snapshot;
    expect(a.meta.artifactHash).toBe(semanticHash(a));
    expect(b.meta.artifactHash).toBe(semanticHash(b));
    expect(a.meta.artifactHash).not.toBe(b.meta.artifactHash);
    const scan = scanFor('G01');
    expect(buildIntegratedReasoningCore({ scan, bazi: a }, GOLDEN_GENERATED_AT).meta.inputHash)
      .not.toBe(buildIntegratedReasoningCore({ scan, bazi: b }, GOLDEN_GENERATED_AT).meta.inputHash);
  });
  it.each(['missing_variant', 'duplicate_theme', 'unknown_ref', 'nonpositive', 'unknown_hour', 'false_stable', 'hash'])('rejects %s', mutation => {
    const bazi = syntheticBazi({ stableThemes: ['analysis_research'] }).snapshot;
    if (mutation === 'missing_variant') bazi.variantAssessments = [];
    if (mutation === 'duplicate_theme') bazi.advantageHypotheses.push(bazi.advantageHypotheses[0]);
    if (mutation === 'unknown_ref') bazi.advantageHypotheses[0].basisRefs = ['missing'];
    if (mutation === 'nonpositive') bazi.variantAssessments[0].themes.analysis_research.support = 'not_established';
    if (mutation === 'unknown_hour') { bazi.timeConfidence = 'unknown'; bazi.advantageHypotheses[0].pillarDependencies = ['pillar:hour']; }
    if (mutation === 'false_stable') bazi.stableSignals.push('missing');
    const forged = reseal(bazi);
    if (mutation === 'hash') forged.meta.artifactHash = 'a'.repeat(64);
    expect(BaziSignalSnapshotSchema.safeParse(forged).success).toBe(false);
  });
  it('counts a positive birth claim as available without inventing a theme decision', () => {
    const bazi = syntheticBazi({ availableEmpty: true }).snapshot;
    bazi.driveHypotheses = [{ id: 'claim:achievement', claimKey: 'achievement', support: 'supports', pillarDependencies: [], basisRefs: ['claim-evidence'], conditions: '合成依据，仅用于规则测试', priority: 'secondary' }];
    bazi.evidenceSources = [{ id: 'claim-evidence', sourceKind: 'traditional_structure', variantId: 'variant-1', basisRef: 'synthetic:claim', verification: 'traditional_hypothesis' }];
    const core = buildIntegratedReasoningCore({ scan: scanFor('G37'), bazi: reseal(bazi) }, GOLDEN_GENERATED_AT);
    expect(core.availability).toBe('bazi_only');
    expect(core.decisions).toEqual([]);
  });
  it('uses the referenced signal ID for time sensitivity, not a guessed theme-derived ID', () => {
    const bazi = syntheticBazi({ timeSensitiveThemes: ['analysis_research'] }).snapshot;
    bazi.advantageHypotheses[0].id = 'birth:research:custom';
    bazi.timeSensitiveSignals[0].signalId = 'birth:research:custom';
    const core = buildIntegratedReasoningCore({ scan: scanFor('G01'), bazi: reseal(bazi) }, GOLDEN_GENERATED_AT);
    expect(core.decisions.find(d => d.theme === 'analysis_research')?.relation).toBe('partially_aligned');
  });
});

describe('Phase 1 independent audit: complete reasoning policy', () => {
  it.each(['decision_ref', 'priority_index', 'difference_ref', 'reason_code', 'conflict_ref', 'source_hash', 'hash'])('rejects forged %s with original source snapshots', mutation => {
    const scan = scanFor('G18');
    const bazi = syntheticBazi({ cautionThemes: ['analysis_research'] }).snapshot;
    const core = buildIntegratedReasoningCore({ scan, bazi }, GOLDEN_GENERATED_AT);
    if (mutation === 'decision_ref') core.decisions[0].evidenceRefs = ['missing'];
    if (mutation === 'priority_index') core.decisions[0].priorityIndex = 999;
    if (mutation === 'difference_ref') core.differences[0].evidenceRefs = ['missing'];
    if (mutation === 'reason_code') core.differences[0].reasonCode = 'arbitrary';
    if (mutation === 'conflict_ref') core.conflicts[0].leftEvidenceRefs = ['missing'];
    if (mutation === 'source_hash') core.sourceSnapshots.bazi.hash = 'a'.repeat(64);
    const forged = reseal(core);
    if (mutation === 'hash') forged.meta.artifactHash = 'a'.repeat(64);
    expect(() => validateIntegratedReasoningCore(forged, { scan, bazi })).toThrow();
  });
  it('rejects free-form Difference codes at schema boundary', () => {
    const scan = scanFor('G18');
    expect(DifferenceSchema.safeParse({ ...scan.differences[0], reasonCode: 'arbitrary' }).success).toBe(false);
  });
  it('preserves all comparable caution variants and is independent of variant order', () => {
    const bazi = syntheticBazi({ cautionThemes: ['analysis_research'] }).snapshot;
    const second = structuredClone(bazi.variantAssessments[0]);
    second.variantId = 'variant-2';
    second.themes.analysis_research.basisRefs = ['second-caution'];
    bazi.chartVariants.push({ ...bazi.chartVariants[0], variantId: 'variant-2' });
    bazi.variantAssessments.push(second);
    bazi.evidenceSources.push({ ...bazi.evidenceSources[0], id: 'second-caution', variantId: 'variant-2' });
    const scan = scanFor('G01');
    const run = (birth: BaziSignalSnapshot) => buildIntegratedReasoningCore({ scan, bazi: reseal(birth) }, GOLDEN_GENERATED_AT);
    const core = run(bazi);
    expect(core.conflicts[0].leftEvidenceRefs).toEqual(['bazi:analysis_research:caution', 'second-caution']);
    bazi.variantAssessments.reverse();
    expect(run(bazi).meta.artifactHash).toBe(core.meta.artifactHash);
  });
});

describe('Phase 1 independent audit: exact Difference evidence and replay', () => {
  it.each([
    ['G18', 'interest_behavior_difference', ['analysis_research', 'creative_expression'], ['scan:Q1.artistic', 'scan:Q2.artistic', 'scan:Q4.artistic', 'scan:Q6.artistic', 'scan:Q7.investigate', 'scan:Q8.investigate', 'scan:Q9.investigate']],
    ['G19', 'recent_scenario_difference', ['analysis_research', 'creative_expression'], ['scan:Q14.create', 'scan:Q7.investigate', 'scan:Q8.investigate', 'scan:Q9.investigate']],
    ['G20', 'ambiguous_recent_evidence', ['action_iteration', 'influence_persuasion'], ['scan:Q14.execute_influence']],
    ['G21', 'followup_preference_difference', ['analysis_research', 'structure_system'], ['scan:FB-IS.investigate', 'scan:FI-IC.conventional', 'scan:Q1.investigative', 'scan:Q10.structure', 'scan:Q2.conventional', 'scan:Q4.investigative', 'scan:Q5.conventional', 'scan:Q7.investigate', 'scan:Q8.structure', 'scan:Q9.investigate']],
  ])('%s retains exact positive themes and references', (id, kind, themes, refs) => {
    const difference = scanFor(id as string).differences.find(d => d.kind === kind);
    expect(difference?.themeIds).toEqual(themes);
    expect(difference?.evidenceRefs).toEqual(refs);
    expect(difference?.isContradiction).toBe(false);
  });
  it('priority divergence cites P and direct B only, unchanged by weak interest support', () => {
    const scan = scanFor('G27');
    const bazi = syntheticBazi({ primaryThemes: ['influence_persuasion'] }).snapshot;
    const difference = buildIntegratedReasoningCore({ scan, bazi }, GOLDEN_GENERATED_AT).differences.find(d => d.kind === 'priority_divergence');
    expect(difference).toMatchObject({
      baziPriorityThemeIds: ['influence_persuasion'], behaviorPriorityThemeIds: ['analysis_research'],
      baziEvidenceRefs: ['bazi:influence_persuasion:support'],
      behaviorEvidenceRefs: ['scan:Q7.investigate', 'scan:Q8.investigate', 'scan:Q9.investigate'],
      evidenceRefs: ['bazi:influence_persuasion:support', 'scan:Q7.investigate', 'scan:Q8.investigate', 'scan:Q9.investigate'],
    });
    const f = goldenAnswers('G27');
    f.answers[1].optionId = 'Q2.uncertain';
    const fixed = { scanVersion: GOLDEN_SCAN_VERSION, answers: f.answers };
    const noWeak = buildAdvantageScanSnapshot({ status: 'completed', ...fixed, followups: { fixedInputHash: planFollowups(fixed).fixedInputHash, answers: [], endedByUser: false } }, GOLDEN_GENERATED_AT);
    expect(buildIntegratedReasoningCore({ scan: noWeak, bazi }, GOLDEN_GENERATED_AT).differences.find(d => d.kind === 'priority_divergence')).toEqual(difference);
  });
  it('preserves partial overlap of I/B without treating it as opposition', () => {
    const f = goldenAnswers('G21');
    f.answers[7].optionId = 'Q8.investigate';
    const fixed = { scanVersion: GOLDEN_SCAN_VERSION, answers: f.answers };
    const scan = buildAdvantageScanSnapshot({ status: 'completed', ...fixed, followups: { fixedInputHash: planFollowups(fixed).fixedInputHash, answers: [{ questionId: 'FI-IC', optionId: 'FI-IC.uncertain' }], endedByUser: false } }, GOLDEN_GENERATED_AT);
    expect(scan.differences[0]).toMatchObject({ kind: 'interest_behavior_difference', leftThemeIds: ['analysis_research', 'structure_system'], rightThemeIds: ['analysis_research'], themeIds: ['analysis_research', 'structure_system'], isContradiction: false });
    expect(scan.conflicts).toEqual([]);
  });
  it('changes neither semantic hashes nor inputs when time and set order change', () => {
    const scan = scanFor('G21'), bazi = syntheticBazi({ stableThemes: ['analysis_research'] }).snapshot;
    const before = structuredClone({ scan, bazi });
    const first = buildIntegratedReasoningCore({ scan, bazi }, GOLDEN_GENERATED_AT);
    expect({ scan, bazi }).toEqual(before);
    scan.meta.generatedAt = '2026-10-07T00:00:00.000Z';
    scan.scanResult!.completedAt = '2026-10-07T00:00:00.000Z';
    bazi.meta.generatedAt = '2026-10-07T00:00:00.000Z';
    scan.evidenceSources.reverse();
    scan.scanResult!.behavior.investigate.evidenceIds.reverse();
    const second = buildIntegratedReasoningCore({ scan, bazi }, '2026-10-07T00:00:00.000Z');
    expect(second.meta.artifactHash).toBe(first.meta.artifactHash);
    expect(second.meta.inputHash).toBe(first.meta.inputHash);
  });
});
