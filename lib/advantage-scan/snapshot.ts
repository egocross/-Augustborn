import { z } from 'zod';
import { asciiCompare, semanticHash, sortedUnique } from '../integrated-report/canonical-hash';
import { HashSchema, makeMeta, sealArtifact, type ScanEvidenceSource } from '../integrated-report/common-schema';
import { ambiguousRecentEvidence, followupPreferenceDifference, interestBehaviorDifference, recentScenarioDifference, type Difference } from '../integrated-report/differences';
import { behaviorStrength, strengthRule, themeLimitations } from '../integrated-report/evidence-policy';
import { BEHAVIOR_DIMENSIONS, BEHAVIOR_THEME, FOLLOWUP_POLICY_VERSION, INTEREST_DIMENSIONS, INTEREST_THEME, RECENT_THEME, SCAN_VERSION, SCORING_VERSION, THEME_IDS, THEME_TASKS, type BehaviorDimension, type InterestDimension, type Theme } from '../integrated-report/ontology';
import { resolveFollowups, type FollowupResolution } from './followup-selector';
import { FixedAnswersInputSchema, ScanAnswerSchema, getOption, getQuestion } from './questions';
import { AdvantageScanSignalSnapshotSchema, type AdvantageScanSignalSnapshot } from './schema';
import { scoreAdvantageScan, type FixedScores } from './scoring';

const SCAN_GENERATOR_VERSION = 'deterministic-scan-v1';

const SkippedInputSchema = z.object({ status: z.literal('skipped'), scanVersion: z.literal(SCAN_VERSION) }).strict();
const CompletedInputSchema = z.object({
  status: z.literal('completed'), scanVersion: z.literal(SCAN_VERSION),
  answers: z.array(ScanAnswerSchema).length(14),
  followups: z.object({ fixedInputHash: HashSchema, answers: z.array(ScanAnswerSchema).max(2), endedByUser: z.boolean() }).strict(),
}).strict();
const SnapshotInputSchema = z.discriminatedUnion('status', [SkippedInputSchema, CompletedInputSchema]);

const themeBehaviorDimension: Partial<Record<Theme, BehaviorDimension>> = {};
for (const d of BEHAVIOR_DIMENSIONS) themeBehaviorDimension[BEHAVIOR_THEME[d]] = d;
const themeInterestDimension: Partial<Record<Theme, InterestDimension>> = {};
for (const d of INTEREST_DIMENSIONS) themeInterestDimension[INTEREST_THEME[d]] = d;

function sameSet(a: Theme[], b: Theme[]): boolean { return a.length === b.length && a.every(t => b.includes(t)); }

function moduleCoverage(scheduledCount: number, uncertaintyCount: number) {
  const effectiveCount = scheduledCount - uncertaintyCount;
  const coverageCode = effectiveCount === 0 ? 'none' : effectiveCount === scheduledCount ? 'full' : 'partial';
  return { uncertaintyCount, answeredCount: scheduledCount, effectiveCount, scheduledCount, coverageCode };
}

function buildSkipped(generatedAt: string): AdvantageScanSignalSnapshot {
  const skipped = { uncertaintyCount: 0, answeredCount: 0, effectiveCount: 0, scheduledCount: 0, coverageCode: 'skipped' as const };
  const inputHash = semanticHash({ status: 'skipped', scanVersion: SCAN_VERSION });
  const meta = makeMeta('advantage-scan-signal-v1', inputHash, generatedAt, SCAN_GENERATOR_VERSION);
  return sealArtifact({
    kind: 'advantage-scan-signal-v1', meta, status: 'skipped', scanResult: null,
    interestSignals: [], behaviorSignals: [], workValues: [], recentEvidence: null,
    uncertainty: { globalCount: 0, interests: skipped, behavior: skipped, values: skipped, recentRecallMissing: null, followupUncertaintyCount: 0, overallCoverageCode: 'skipped' },
    derivedAdvantageHypotheses: [], taskPreferences: [], signalStrength: [], differences: [], conflicts: [], evidenceSources: [],
  });
}

function buildCompleted(fixed: z.infer<typeof FixedAnswersInputSchema>, scores: FixedScores, resolved: FollowupResolution[], generatedAt: string): AdvantageScanSignalSnapshot {
  const recentTheme: Theme | null = scores.recentEvidence.signal !== null ? RECENT_THEME[scores.recentEvidence.signal] : null;
  const recentEvidenceId = scores.recentEvidence.evidenceId;
  const behaviorCount = (theme: Theme) => { const d = themeBehaviorDimension[theme]; return d ? scores.behavior[d].raw : 0; };
  const interestCount = (theme: Theme) => { const d = themeInterestDimension[theme]; return d ? scores.interests[d].raw : 0; };
  const behaviorEvidenceFor = (themes: Theme[]) => sortedUnique(themes.map(t => { const d = themeBehaviorDimension[t]; return d ? scores.behavior[d].evidenceIds : []; }).flat());
  const interestEvidenceFor = (themes: Theme[]) => sortedUnique(themes.map(t => { const d = themeInterestDimension[t]; return d ? scores.interests[d].evidenceIds : []; }).flat());
  const themeEvidence = (theme: Theme) => sortedUnique([
    ...(themeBehaviorDimension[theme] ? scores.behavior[themeBehaviorDimension[theme]!].evidenceIds : []),
    ...(themeInterestDimension[theme] ? scores.interests[themeInterestDimension[theme]!].evidenceIds : []),
    ...(recentTheme === theme && recentEvidenceId ? [recentEvidenceId] : []),
  ]);
  const themeSourceKinds = (theme: Theme): string[] => sortedUnique([
    ...(behaviorCount(theme) >= 1 ? ['scenario_choice'] : []),
    ...(interestCount(theme) >= 1 ? ['activity_interest'] : []),
    ...(recentTheme === theme ? ['recent_self_report'] : []),
  ]);

  const interestSignals = INTEREST_DIMENSIONS.filter(d => scores.interests[d].raw > 0).map(d => ({ dimension: d, ...scores.interests[d] }));
  const behaviorSignals = BEHAVIOR_DIMENSIONS.filter(d => scores.behavior[d].raw > 0).map(d => ({ dimension: d, ...scores.behavior[d] }));
  const workValues = Object.keys(scores.values).filter(d => scores.values[d as keyof typeof scores.values].raw > 0).map(d => ({ dimension: d, ...scores.values[d as keyof typeof scores.values] }));

  const followups = resolved.map(r => ({ questionId: r.questionId, pairKey: r.pairKey, reasonCode: r.reasonCode, optionId: r.optionId, status: r.status, section: r.section, themePairKey: r.themePairKey, winnerThemeId: r.winnerThemeId, loserThemeId: r.loserThemeId }));

  const supportedThemes = THEME_IDS.filter(t => themeSourceKinds(t).length > 0);
  const derivedAdvantageHypotheses = supportedThemes.map(theme => {
    const strength = behaviorStrength(theme, behaviorCount(theme), { scheduledCount: 4, answeredCount: 4 });
    return { id: 'adv:' + theme, theme, strength, strengthCeiling: theme === 'hands_on_problem_solving' ? 'tentative' : strength, ruleId: strengthRule(strength), evidenceIds: themeEvidence(theme), limitations: themeLimitations(theme) };
  });
  const signalStrength = supportedThemes.map(theme => { const strength = behaviorStrength(theme, behaviorCount(theme), { scheduledCount: 4, answeredCount: 4 }); return { theme, level: strength, ruleId: strengthRule(strength) }; });
  const taskPreferences = supportedThemes.flatMap(theme => THEME_TASKS[theme].map((task, i) => ({ taskId: 'task:' + theme + ':' + (i + 1), theme, evidenceIds: themeEvidence(theme) })));

  const differences: Difference[] = [];
  const interestEffective = INTEREST_DIMENSIONS.reduce((s, d) => s + scores.interests[d].raw, 0);
  const maxInterest = Math.max(...INTEREST_DIMENSIONS.map(d => scores.interests[d].raw));
  const I: Theme[] = (interestEffective >= 4 && maxInterest >= 2) ? INTEREST_DIMENSIONS.filter(d => scores.interests[d].raw === maxInterest).map(d => INTEREST_THEME[d]) : [];
  const maxBehavior = Math.max(...BEHAVIOR_DIMENSIONS.map(d => scores.behavior[d].raw));
  const B: Theme[] = (maxBehavior >= 2) ? BEHAVIOR_DIMENSIONS.filter(d => scores.behavior[d].raw === maxBehavior).map(d => BEHAVIOR_THEME[d]) : [];
  if (I.length && B.length && !sameSet(I, B) && I.every(t => interestCount(t) >= 2) && B.every(t => behaviorCount(t) >= 2)) {
    differences.push(interestBehaviorDifference(I, B, interestEvidenceFor(I), behaviorEvidenceFor(B)));
  }
  if (recentTheme && recentEvidenceId && B.length && !B.includes(recentTheme)) {
    differences.push(recentScenarioDifference(recentTheme, B, recentEvidenceId, behaviorEvidenceFor(B)));
  }
  if (scores.recentEvidence.optionId === 'Q14.execute_influence') {
    differences.push(ambiguousRecentEvidence(scores.recentEvidence.evidenceId));
  }
  const resolvedFollowups = resolved.filter(r => r.status === 'resolved');
  const behaviorResolved = resolvedFollowups.filter(r => r.section === 'behavior');
  const interestResolved = resolvedFollowups.filter(r => r.section === 'interests');
  outer: for (const b of behaviorResolved) {
    for (const i of interestResolved) {
      if (b.themePairKey === i.themePairKey && b.winnerThemeId === i.loserThemeId && b.loserThemeId === i.winnerThemeId && b.winnerThemeId && b.loserThemeId) {
        differences.push(followupPreferenceDifference([b.winnerThemeId, b.loserThemeId], b.winnerThemeId, b.loserThemeId, ['scan:' + b.optionId, 'scan:' + i.optionId], sortedUnique([...b.triggerEvidenceRefs, ...i.triggerEvidenceRefs])));
        break outer;
      }
    }
  }

  const evidenceSources: ScanEvidenceSource[] = [];
  for (const answer of [...fixed.answers].sort((a, b) => asciiCompare(a.questionId, b.questionId))) {
    const question = getQuestion(answer.questionId);
    const option = getOption(answer.questionId, answer.optionId);
    if (option.responseKind !== 'signal') continue;
    if (question.section === 'behavior') evidenceSources.push({ id: 'scan:' + answer.optionId, sourceKind: 'scenario_choice', questionId: answer.questionId, optionId: answer.optionId, verification: 'self_report_unverified' });
    else if (question.section === 'interests') evidenceSources.push({ id: 'scan:' + answer.optionId, sourceKind: 'activity_interest', questionId: answer.questionId, optionId: answer.optionId, verification: 'self_report_unverified' });
    else if (question.section === 'values') evidenceSources.push({ id: 'scan:' + answer.optionId, sourceKind: 'work_value', questionId: answer.questionId, optionId: answer.optionId, verification: 'self_report_unverified' });
    else if (question.section === 'recent') evidenceSources.push({ id: 'scan:' + answer.optionId, sourceKind: 'recent_self_report', questionId: answer.questionId, optionId: answer.optionId, verification: 'self_report_unverified' });
  }
  for (const r of resolvedFollowups) {
    evidenceSources.push({ id: 'scan:' + r.optionId, sourceKind: 'followup_preference', questionId: r.questionId, optionId: r.optionId!, verification: 'self_report_unverified', section: r.section, themePairKey: r.themePairKey, winnerThemeId: r.winnerThemeId!, loserThemeId: r.loserThemeId!, triggerEvidenceRefs: r.triggerEvidenceRefs });
  }

  const inputHash = semanticHash({ scanVersion: SCAN_VERSION, scoringVersion: SCORING_VERSION, followupPolicyVersion: FOLLOWUP_POLICY_VERSION, answers: fixed.answers.map(a => a.optionId).sort(asciiCompare), followups: resolved.map(r => r.optionId ?? '').sort(asciiCompare), endedByUser: resolved.some(r => r.status === 'ended_by_user') });
  const scanResult = {
    schemaVersion: 'advantage-result-v1' as const, scanVersion: SCAN_VERSION, scoringVersion: SCORING_VERSION, followupPolicyVersion: FOLLOWUP_POLICY_VERSION, status: 'completed' as const,
    interests: scores.interests, behavior: scores.behavior, values: scores.values, recentEvidence: scores.recentEvidence,
    uncertaintyCount: scores.uncertaintyCount, uncertaintyBySection: scores.uncertaintyBySection, recentRecallMissing: scores.recentRecallMissing,
    followups, inputHash, completedAt: generatedAt,
  };
  const q1to10Effective = (6 - scores.uncertaintyBySection.interests) + (4 - scores.uncertaintyBySection.behavior);
  const status = (scores.uncertaintyCount >= 5 || q1to10Effective <= 2) ? 'low_information' : 'completed';
  const uncertainty = {
    globalCount: scores.uncertaintyCount,
    interests: moduleCoverage(6, scores.uncertaintyBySection.interests),
    behavior: moduleCoverage(4, scores.uncertaintyBySection.behavior),
    values: moduleCoverage(3, scores.uncertaintyBySection.values),
    recentRecallMissing: scores.recentRecallMissing,
    followupUncertaintyCount: resolved.filter(r => r.status === 'unresolved').length,
    overallCoverageCode: (scores.uncertaintyCount >= 5 ? 'partial' : q1to10Effective <= 2 ? 'partial' : 'full') as 'full' | 'partial',
  };
  const meta = makeMeta('advantage-scan-signal-v1', inputHash, generatedAt, SCAN_GENERATOR_VERSION);
  return sealArtifact(AdvantageScanSignalSnapshotSchema.parse({
    kind: 'advantage-scan-signal-v1', meta, status, scanResult,
    interestSignals, behaviorSignals, workValues, recentEvidence: scores.recentEvidence,
    uncertainty, derivedAdvantageHypotheses, taskPreferences, signalStrength, differences, conflicts: [], evidenceSources,
  }));
}

export function buildAdvantageScanSnapshot(input: unknown, generatedAt: string): AdvantageScanSignalSnapshot {
  const parsed = SnapshotInputSchema.parse(input);
  if (parsed.status === 'skipped') return buildSkipped(generatedAt);
  const fixed = FixedAnswersInputSchema.parse({ scanVersion: parsed.scanVersion, answers: parsed.answers });
  const scores = scoreAdvantageScan(fixed);
  const resolved = resolveFollowups(fixed, parsed.followups);
  return buildCompleted(fixed, scores, resolved, generatedAt);
}
