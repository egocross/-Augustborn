import { describe, expect, it } from 'vitest';
import { buildAdvantageScanSnapshot } from '../lib/advantage-scan/snapshot';
import { BankSchema, QUESTION_BANK, ScanAnswerSchema } from '../lib/advantage-scan/questions';
import { planFollowups } from '../lib/advantage-scan/followup-selector';
import { RecentEvidenceSchema } from '../lib/advantage-scan/schema';
import { buildIntegratedReasoningCore } from '../lib/integrated-report/reasoning-core';
import { validateIntegratedReasoningCore } from '../lib/integrated-report/core-schema';
import { RelationSchema } from '../lib/integrated-report/common-schema';
import { semanticHash } from '../lib/integrated-report/canonical-hash';
import { partitionCandidates, type SelectionCandidate } from '../lib/integrated-report/selection';
import { syntheticBazi } from './fixtures/integrated-advantage/synthetic-bazi';
import { GOLDEN_GENERATED_AT, GOLDEN_SCAN_VERSION, goldenAnswers, replaceAnswers, type BaziCase, type GoldenAnswers } from './fixtures/integrated-advantage/answers';
import { THEMES } from './fixtures/integrated-advantage/expected-core';

function completedInput(f: GoldenAnswers) {
  const fixed = { scanVersion: GOLDEN_SCAN_VERSION, answers: f.answers };
  return { status: 'completed' as const, ...fixed, followups: { fixedInputHash: planFollowups(fixed).fixedInputHash, answers: f.followupAnswers, endedByUser: f.endedByUser } };
}
function scanFor(f: GoldenAnswers) {
  return buildAdvantageScanSnapshot(f.status === 'skipped' ? { status: 'skipped', scanVersion: GOLDEN_SCAN_VERSION } : completedInput(f), f.generatedAt);
}
function baziFor(kind: BaziCase) {
  switch (kind) {
    case 'unavailable': return syntheticBazi().snapshot;
    case 'overseas': return syntheticBazi({ unavailableReason: 'overseas_civil_time_unsupported' }).snapshot;
    case 'influence': return syntheticBazi({ stableThemes: ['influence_persuasion'], primaryThemes: ['influence_persuasion'] }).snapshot;
    case 'influence_research': return syntheticBazi({ stableThemes: ['influence_persuasion', 'analysis_research'], primaryThemes: ['influence_persuasion', 'analysis_research'] }).snapshot;
    case 'structure': return syntheticBazi({ stableThemes: ['structure_system'] }).snapshot;
    case 'hands': return syntheticBazi({ stableThemes: ['hands_on_problem_solving'] }).snapshot;
    case 'creative': return syntheticBazi({ stableThemes: ['creative_expression'], primaryThemes: ['creative_expression'] }).snapshot;
    case 'caution': return syntheticBazi({ cautionThemes: ['analysis_research'] }).snapshot;
    case 'other_task': return syntheticBazi({ cautionThemes: ['analysis_research'], taskMismatch: true }).snapshot;
    case 'not_established': return syntheticBazi({ stableThemes: [] }).snapshot;
    case 'time_sensitive_creative': return syntheticBazi({ timeSensitiveThemes: ['creative_expression'] }).snapshot;
  }
}
function run(f: GoldenAnswers) { const scan = scanFor(f), bazi = baziFor(f.baziCase); return { scan, bazi, core: buildIntegratedReasoningCore({ scan, bazi }, f.generatedAt) }; }
function withFollowups(id: string, followupAnswers: string[], endedByUser = false): GoldenAnswers {
  const f = goldenAnswers(id); f.followupAnswers = followupAnswers.map(optionId => ({ questionId: optionId.split('.')[0], optionId })); f.endedByUser = endedByUser; return f;
}
function changed(id: string, replacements: Record<string, string>, followupAnswers?: string[]): GoldenAnswers {
  const f = goldenAnswers(id); f.answers = replaceAnswers(f.answers, replacements);
  if (followupAnswers) f.followupAnswers = followupAnswers.map(optionId => ({ questionId: optionId.split('.')[0], optionId })); return f;
}

describe('determinism and isolation invariants', () => {
  it('reproduces the identical semantic result across 100 recomputations', () => {
    const first = run(goldenAnswers('G21')); const firstHash = semanticHash(first.core);
    for (let i = 0; i < 100; i++) expect(semanticHash(run(goldenAnswers('G21')).core)).toBe(firstHash);
  });
  it('interest and value answers never change behavior-derived strength', () => {
    const base = run(goldenAnswers('G09'));
    const alt = run(changed('G09', { Q1: 'Q1.uncertain', Q2: 'Q2.uncertain', Q3: 'Q3.uncertain', Q4: 'Q4.uncertain', Q5: 'Q5.uncertain', Q6: 'Q6.uncertain', Q11: 'Q11.workingConditions', Q12: 'Q12.workingConditions', Q13: 'Q13.workingConditions' }));
    const strength = (c: typeof base.core) => c.decisions.filter(d => d.theme === THEMES.research).map(d => d.strength);
    expect(strength(alt.core)).toEqual(strength(base.core));
    expect(alt.scan.scanResult?.behavior).toEqual(base.scan.scanResult?.behavior);
  });
  it('changing the synthetic bazi fixture never mutates the scan snapshot', () => {
    const f = goldenAnswers('G01'); const scan = scanFor(f); const before = structuredClone(scan);
    buildIntegratedReasoningCore({ scan, bazi: syntheticBazi({ stableThemes: ['influence_persuasion'], primaryThemes: ['influence_persuasion'] }).snapshot }, GOLDEN_GENERATED_AT);
    expect(scan).toEqual(before);
  });
  it('Q14 and followups never change the fixed raw counts', () => {
    const base = goldenAnswers('G05');
    expect(scanFor(changed('G05', { Q14: 'Q14.create' })).scanResult?.behavior).toEqual(scanFor(base).scanResult?.behavior);
    expect(scanFor(withFollowups('G02', ['FB-IS.structure'])).scanResult?.behavior.investigate.raw).toBe(scanFor(goldenAnswers('G02')).scanResult?.behavior.investigate.raw);
  });
  it('aligned birth support does not raise behavior strength', () => {
    const scanOnly = run(goldenAnswers('G09')); const aligned = run({ ...goldenAnswers('G09'), baziCase: 'influence_research' });
    const research = (c: typeof scanOnly.core) => c.decisions.find(d => d.theme === THEMES.research);
    expect(research(aligned.core)?.strength).toBe(research(scanOnly.core)?.strength);
  });
  it('the question bank is deeply frozen against mutation', () => {
    expect(Object.isFrozen(QUESTION_BANK)).toBe(true);
    expect(Object.isFrozen(QUESTION_BANK.questions)).toBe(true);
    expect(Object.isFrozen(QUESTION_BANK.questions[0])).toBe(true);
    expect(() => Object.assign(QUESTION_BANK.questions[0], { prompt: 'x' })).toThrow();
  });
  it('every evidence reference resolves to a real source', () => {
    for (const id of ['G01', 'G02', 'G05', 'G08', 'G09', 'G18', 'G19', 'G21', 'G27', 'G35']) {
      const { scan, bazi, core } = run(goldenAnswers(id));
      const scanIds = new Set(scan.evidenceSources.map(s => s.id));
      const baziIds = new Set(bazi.evidenceSources.map(s => s.id));
      for (const d of core.decisions) for (const ref of d.evidenceRefs) expect(scanIds.has(ref) || baziIds.has(ref)).toBe(true);
      for (const diff of core.differences) for (const ref of diff.evidenceRefs) expect(scanIds.has(ref) || baziIds.has(ref)).toBe(true);
      for (const conflict of core.conflicts) { for (const ref of conflict.leftEvidenceRefs) expect(baziIds.has(ref)).toBe(true); for (const ref of conflict.rightEvidenceRefs) expect(scanIds.has(ref)).toBe(true); }
    }
  });
  it('differences and conflicts only reference legal, existing theme ids', () => {
    const { core } = run(goldenAnswers('G08'));
    const decisionThemes = new Set(core.decisions.map(d => d.theme));
    for (const d of core.differences) { for (const t of d.themeIds) expect(decisionThemes.has(t)).toBe(true); expect(d.isContradiction).toBe(false); }
    for (const c of core.conflicts) expect(decisionThemes.has(c.themeId)).toBe(true);
  });
  it('skipped and completed-none snapshots carry distinct hashes', () => {
    expect(scanFor(goldenAnswers('G37')).meta.inputHash).not.toBe(scanFor(goldenAnswers('G36')).meta.inputHash);
    expect(scanFor(goldenAnswers('G37')).meta.artifactHash).not.toBe(scanFor(goldenAnswers('G36')).meta.artifactHash);
  });
});

describe('S01 top-5 capacity partition', () => {
  it('sorts six eligible same-tier candidates stably and partitions the overflow', () => {
    const themes = ['analysis_research', 'structure_system', 'creative_expression', 'collaboration_helping', 'action_iteration', 'influence_persuasion'];
    const make = (order: string[]) => order.map(t => ({ id: 'decision:' + t, theme: t, strength: 'tentative', behaviorCount: 1, interestCount: 1, recentMatch: false, eligible: true, birthOnly: false } as SelectionCandidate));
    const result = partitionCandidates(make(themes), []);
    expect(result.selected.map(c => c.theme)).toEqual(['action_iteration', 'analysis_research', 'collaboration_helping', 'creative_expression', 'influence_persuasion']);
    expect(result.secondary.map(c => c.theme)).toEqual(['structure_system']);
    expect(result.secondary[0].priorityReasonCodes).toEqual(['display_capacity_limit']);
    expect(partitionCandidates(make([...themes].reverse()), []).selected.map(c => c.id)).toEqual(result.selected.map(c => c.id));
  });
});

describe('difference and identity negative cases', () => {
  it('N01: interest effective below four produces no interest-behavior difference', () => {
    const f = changed('G02', { Q1: 'Q1.investigative', Q2: 'Q2.investigative', Q3: 'Q3.uncertain', Q4: 'Q4.uncertain', Q5: 'Q5.uncertain', Q6: 'Q6.uncertain' });
    expect(run(f).core.differences.map(d => d.kind)).not.toContain('interest_behavior_difference');
  });
  it('N02: behavior primary set empty produces no interest-behavior difference', () => {
    const f = changed('G18', { Q7: 'Q7.investigate', Q8: 'Q8.structure', Q9: 'Q9.create', Q10: 'Q10.execute' });
    expect(run(f).core.differences.map(d => d.kind)).not.toContain('interest_behavior_difference');
  });
  it('N03: identical I/B and unresolved pairs produce no followup difference', () => {
    const f = withFollowups('G21', ['FB-IS.uncertain', 'FI-IC.uncertain']);
    const { core } = run(f); expect(core.differences.map(d => d.kind)).not.toContain('followup_preference_difference');
  });
  it('N04: recent inside behavior primary set produces no recent-scenario difference', () => {
    expect(run(changed('G02', { Q14: 'Q14.structure' })).core.differences.map(d => d.kind)).not.toContain('recent_scenario_difference');
  });
  it('N05: none yields no ambiguous/recent difference; execute_influence yields exactly one ambiguous', () => {
    const none = run(changed('G19', { Q14: 'Q14.none' })).core.differences.map(d => d.kind);
    expect(none).not.toContain('recent_scenario_difference'); expect(none).not.toContain('ambiguous_recent_evidence');
    const ambiguous = run(changed('G19', { Q14: 'Q14.execute_influence' })).core.differences.filter(d => d.kind === 'ambiguous_recent_evidence');
    expect(ambiguous).toHaveLength(1);
  });
  it('N06: different pair, same direction, and one unresolved never form a followup difference', () => {
    for (const f of [withFollowups('G16', ['FB-IS.structure', 'FI-IA.investigative']), withFollowups('G22', ['FB-IS.investigate', 'FI-IC.investigative']), withFollowups('G23', ['FB-IS.uncertain', 'FI-IC.conventional'])]) {
      expect(run(f).core.differences.map(d => d.kind)).not.toContain('followup_preference_difference');
    }
  });
  it('N07: an unplanned followup answer is rejected', () => {
    expect(() => scanFor(withFollowups('G01', ['FI-IC.conventional']))).toThrow();
  });
  it('N08: alphabetic and cross-question option ids are rejected, semantic ids accepted', () => {
    expect(ScanAnswerSchema.safeParse({ questionId: 'Q8', optionId: 'A' }).success).toBe(false);
    expect(ScanAnswerSchema.safeParse({ questionId: 'Q8', optionId: 'Q7.investigate' }).success).toBe(false);
    expect(ScanAnswerSchema.safeParse({ questionId: 'Q8', optionId: 'Q8.investigate' }).success).toBe(true);
  });
  it('N09: client-forged fields and unknown versions are rejected', () => {
    expect(ScanAnswerSchema.safeParse({ questionId: 'Q8', optionId: 'Q8.investigate', dimension: 'investigate' }).success).toBe(false);
    const bank = structuredClone(QUESTION_BANK); bank.questions[0].options[1].displayOrder = 1;
    expect(BankSchema.safeParse(bank).success).toBe(false);
    expect(ScanAnswerSchema.safeParse({ questionId: 'Q8', optionId: 'Q8.investigate', scanVersion: 'advantage-scan-v1' }).success).toBe(false);
  });
  it('N10: replay is idempotent with at most one record per difference kind', () => {
    const a = run(goldenAnswers('G21')); const b = run(goldenAnswers('G21'));
    expect(a.core.differences.map(d => d.id)).toEqual(b.core.differences.map(d => d.id));
    for (const kind of new Set(a.core.differences.map(d => d.kind))) expect(a.core.differences.filter(d => d.kind === kind)).toHaveLength(1);
  });
  it('N11: skipped scan plus birth only produces no priority divergence', () => {
    const f = goldenAnswers('G37'); const scan = scanFor(f); const bazi = syntheticBazi({ stableThemes: ['creative_expression'] }).snapshot;
    expect(buildIntegratedReasoningCore({ scan, bazi }, GOLDEN_GENERATED_AT).differences.map(d => d.kind)).not.toContain('priority_divergence');
  });
  it('N12: intersecting primary and behavior sets produce no priority divergence', () => {
    expect(run(goldenAnswers('G29')).core.differences.map(d => d.kind)).not.toContain('priority_divergence');
  });
  it('N13: weak scan support does not erase an existing priority divergence', () => {
    expect(run(goldenAnswers('G27')).core.differences.map(d => d.kind)).toContain('priority_divergence');
    expect(run(goldenAnswers('G28')).core.differences.map(d => d.kind)).toContain('priority_divergence');
  });
  it('N14: duplicated or single-kind interest sources never become two scan source kinds', () => {
    const { core } = run(goldenAnswers('G31'));
    expect(core.selectedDecisionIds).toEqual([]);
    expect(core.secondaryDecisionIds.map(id => core.decisions.find(d => d.id === id)?.priorityReasonCodes)).toEqual([['single_positive_source']]);
  });
  it('N15: single-source and birth-only themes stay in secondary', () => {
    for (const id of ['G13', 'G30', 'G31', 'G32', 'G34']) { const { core } = run(goldenAnswers(id)); for (const sid of core.selectedDecisionIds) expect(core.secondaryDecisionIds).not.toContain(sid); }
  });
  it('N16: a forged partition is rejected by the policy validator', () => {
    const f = goldenAnswers('G30'); const { scan, bazi, core } = run(f);
    const forged = { ...core, selectedDecisionIds: ['decision:analysis_research'], secondaryDecisionIds: [] as string[] };
    expect(() => validateIntegratedReasoningCore(forged, { scan, bazi })).toThrow();
  });
  it('N17: illegal Q14 null/signal combinations are rejected by the strict union', () => {
    expect(RecentEvidenceSchema.safeParse({ optionId: 'Q14.none', signal: 'none', evidenceId: null, verification: 'self_report_unverified' }).success).toBe(false);
    expect(RecentEvidenceSchema.safeParse({ optionId: 'Q14.none', signal: null, evidenceId: 'scan:Q14.none', verification: 'self_report_unverified' }).success).toBe(false);
    expect(RecentEvidenceSchema.safeParse({ optionId: 'Q14.hands_on', signal: 'create', evidenceId: 'scan:Q14.hands_on', verification: 'self_report_unverified' }).success).toBe(false);
  });
  it('N19: old or unknown relation terminology is rejected by the enum', () => {
    expect(RelationSchema.safeParse('behavior_aligned').success).toBe(false);
    expect(RelationSchema.safeParse('scan_supported_only').success).toBe(true);
  });
});
