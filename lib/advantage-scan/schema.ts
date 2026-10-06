import { z } from 'zod';
import { BoundedTextSchema, HashSchema, MetaSchema, PositiveStrengthSchema, ScanEvidenceSourceSchema } from '../integrated-report/common-schema';
import { ConflictSchema } from '../integrated-report/conflicts';
import { DifferenceSchema } from '../integrated-report/differences';
import { canonicalSemantic, semanticHash } from '../integrated-report/canonical-hash';
import { buildAdvantageScanSnapshot } from './snapshot';
import { FIXED_QUESTIONS } from './questions';
import { planFollowups } from './followup-selector';
import { BEHAVIOR_DIMENSIONS, FOLLOWUP_POLICY_VERSION, INTEREST_DIMENSIONS, SCAN_VERSION, SCORING_VERSION, ThemeSchema, VALUE_DIMENSIONS } from '../integrated-report/ontology';

export const ScoreCellSchema = z.object({
  raw: z.number().int().min(0).max(4), scheduledExposure: z.number().int().positive().max(6),
  normalized: z.object({ numerator: z.number().int().min(0).max(4), denominator: z.number().int().positive().max(6) }).strict(),
  evidenceIds: z.array(z.string().min(1).max(200)),
}).strict();
export type ScoreCell = z.infer<typeof ScoreCellSchema>;

export const RecentEvidenceSchema = z.discriminatedUnion('optionId', [
  z.object({ optionId: z.literal('Q14.none'), signal: z.literal(null), evidenceId: z.literal(null), verification: z.literal('self_report_unverified') }).strict(),
  z.object({ optionId: z.literal('Q14.structure'), signal: z.literal('structure'), evidenceId: z.string().min(1).max(200), verification: z.literal('self_report_unverified') }).strict(),
  z.object({ optionId: z.literal('Q14.investigate'), signal: z.literal('investigate'), evidenceId: z.string().min(1).max(200), verification: z.literal('self_report_unverified') }).strict(),
  z.object({ optionId: z.literal('Q14.create'), signal: z.literal('create'), evidenceId: z.string().min(1).max(200), verification: z.literal('self_report_unverified') }).strict(),
  z.object({ optionId: z.literal('Q14.collaborate'), signal: z.literal('collaborate'), evidenceId: z.string().min(1).max(200), verification: z.literal('self_report_unverified') }).strict(),
  z.object({ optionId: z.literal('Q14.execute_influence'), signal: z.literal('execute_influence'), evidenceId: z.string().min(1).max(200), verification: z.literal('self_report_unverified') }).strict(),
  z.object({ optionId: z.literal('Q14.hands_on'), signal: z.literal('hands_on'), evidenceId: z.string().min(1).max(200), verification: z.literal('self_report_unverified') }).strict(),
]);
export type RecentEvidence = z.infer<typeof RecentEvidenceSchema>;

export const FollowupResultSchema = z.object({
  questionId: z.string().min(1).max(20), pairKey: z.string().min(1).max(150), reasonCode: z.string().min(1).max(200),
  optionId: z.string().min(1).max(80).nullable(), status: z.enum(['resolved', 'unresolved', 'ended_by_user', 'not_reached']),
  section: z.enum(['interests', 'behavior']), themePairKey: z.string().min(1).max(150),
  winnerThemeId: ThemeSchema.nullable(), loserThemeId: ThemeSchema.nullable(),
}).strict();
export type FollowupResult = z.infer<typeof FollowupResultSchema>;

export const AdvantageScanResultSchema = z.object({
  schemaVersion: z.literal('advantage-result-v1'), scanVersion: z.literal(SCAN_VERSION), scoringVersion: z.literal(SCORING_VERSION), followupPolicyVersion: z.literal(FOLLOWUP_POLICY_VERSION),
  status: z.literal('completed'),
  interests: z.record(z.enum(INTEREST_DIMENSIONS), ScoreCellSchema),
  behavior: z.record(z.enum(BEHAVIOR_DIMENSIONS), ScoreCellSchema),
  values: z.record(z.enum(VALUE_DIMENSIONS), ScoreCellSchema),
  recentEvidence: RecentEvidenceSchema,
  uncertaintyCount: z.number().int().min(0).max(13),
  uncertaintyBySection: z.object({ interests: z.number().int().min(0), behavior: z.number().int().min(0), values: z.number().int().min(0) }).strict(),
  recentRecallMissing: z.boolean(),
  followups: z.array(FollowupResultSchema),
  inputHash: HashSchema, completedAt: z.iso.datetime(),
}).strict().superRefine((result, ctx) => {
  if (result.recentRecallMissing !== (result.recentEvidence.optionId === 'Q14.none')) ctx.addIssue({ code: 'custom', message: 'RECENT_RECALL_MISMATCH' });
});
export type AdvantageScanResult = z.infer<typeof AdvantageScanResultSchema>;

const scoreCellFields = {
  raw: z.number().int().min(0).max(4), scheduledExposure: z.number().int().positive().max(6),
  normalized: z.object({ numerator: z.number().int().min(0).max(4), denominator: z.number().int().positive().max(6) }).strict(),
  evidenceIds: z.array(z.string().min(1).max(200)),
};
export const InterestSignalSchema = z.object({ dimension: z.enum(INTEREST_DIMENSIONS), ...scoreCellFields }).strict();
export const BehaviorSignalSchema = z.object({ dimension: z.enum(BEHAVIOR_DIMENSIONS), ...scoreCellFields }).strict();
export const ValueSignalSchema = z.object({ dimension: z.enum(VALUE_DIMENSIONS), ...scoreCellFields }).strict();
export type InterestSignal = z.infer<typeof InterestSignalSchema>;
export type BehaviorSignal = z.infer<typeof BehaviorSignalSchema>;
export type ValueSignal = z.infer<typeof ValueSignalSchema>;

export const ModuleCoverageSchema = z.object({
  uncertaintyCount: z.number().int().min(0).max(6), answeredCount: z.number().int().min(0).max(6),
  effectiveCount: z.number().int().min(0).max(6), scheduledCount: z.number().int().min(0).max(6),
  coverageCode: z.enum(['none', 'partial', 'full', 'skipped']),
}).strict();
export const UncertaintySummarySchema = z.object({
  globalCount: z.number().int().min(0).max(13),
  interests: ModuleCoverageSchema, behavior: ModuleCoverageSchema, values: ModuleCoverageSchema,
  recentRecallMissing: z.boolean().nullable(),
  followupUncertaintyCount: z.number().int().min(0),
  overallCoverageCode: z.enum(['none', 'partial', 'full', 'skipped']),
}).strict();
export type UncertaintySummary = z.infer<typeof UncertaintySummarySchema>;

export const AdvantageHypothesisSchema = z.object({
  id: z.string().min(1).max(200), theme: ThemeSchema, strength: PositiveStrengthSchema, strengthCeiling: PositiveStrengthSchema,
  ruleId: z.string().min(1).max(200), evidenceIds: z.array(z.string().min(1).max(200)), limitations: z.array(BoundedTextSchema),
}).strict();
export const TaskPreferenceSchema = z.object({
  taskId: z.string().min(1).max(200), theme: ThemeSchema, evidenceIds: z.array(z.string().min(1).max(200)),
}).strict();
export const ThemeStrengthSchema = z.object({
  theme: ThemeSchema, level: PositiveStrengthSchema, ruleId: z.string().min(1).max(200),
}).strict();

export const AdvantageScanSignalSnapshotSchema = z.object({
  kind: z.literal('advantage-scan-signal-v1'), meta: MetaSchema,
  status: z.enum(['completed', 'low_information', 'skipped']),
  scanResult: AdvantageScanResultSchema.nullable(),
  interestSignals: z.array(InterestSignalSchema),
  behaviorSignals: z.array(BehaviorSignalSchema),
  workValues: z.array(ValueSignalSchema),
  recentEvidence: RecentEvidenceSchema.nullable(),
  uncertainty: UncertaintySummarySchema,
  derivedAdvantageHypotheses: z.array(AdvantageHypothesisSchema).max(7),
  taskPreferences: z.array(TaskPreferenceSchema),
  signalStrength: z.array(ThemeStrengthSchema).max(7),
  differences: z.array(DifferenceSchema),
  conflicts: z.array(ConflictSchema),
  evidenceSources: z.array(ScanEvidenceSourceSchema),
}).strict().superRefine((snapshot, ctx) => {
  if (snapshot.status === 'skipped') {
    if (snapshot.scanResult !== null) ctx.addIssue({ code: 'custom', message: 'SKIPPED_SCAN_RESULT_MUST_BE_NULL' });
    if (snapshot.recentEvidence !== null) ctx.addIssue({ code: 'custom', message: 'SKIPPED_RECENT_EVIDENCE_MUST_BE_NULL' });
    if (snapshot.uncertainty.recentRecallMissing !== null) ctx.addIssue({ code: 'custom', message: 'SKIPPED_RECALL_MUST_BE_NULL' });
    if (snapshot.uncertainty.overallCoverageCode !== 'skipped') ctx.addIssue({ code: 'custom', message: 'SKIPPED_COVERAGE_MUST_BE_SKIPPED' });
    const emptyArrays = [snapshot.interestSignals, snapshot.behaviorSignals, snapshot.workValues, snapshot.derivedAdvantageHypotheses, snapshot.taskPreferences, snapshot.signalStrength, snapshot.differences, snapshot.conflicts, snapshot.evidenceSources];
    if (emptyArrays.some(a => a.length !== 0)) ctx.addIssue({ code: 'custom', message: 'SKIPPED_ARRAYS_MUST_BE_EMPTY' });
  } else {
    if (snapshot.scanResult === null) ctx.addIssue({ code: 'custom', message: 'COMPLETED_SCAN_RESULT_REQUIRED' });
    if (snapshot.recentEvidence === null) ctx.addIssue({ code: 'custom', message: 'COMPLETED_RECENT_EVIDENCE_REQUIRED' });
    if (snapshot.uncertainty.recentRecallMissing === null) ctx.addIssue({ code: 'custom', message: 'COMPLETED_RECALL_MUST_BE_BOOLEAN' });
    if (snapshot.scanResult !== null && snapshot.recentEvidence !== null) {
      if (canonicalSemantic(snapshot.scanResult.recentEvidence) !== canonicalSemantic(snapshot.recentEvidence)) ctx.addIssue({ code: 'custom', message: 'RECENT_EVIDENCE_MISMATCH' });
      if (snapshot.scanResult.recentRecallMissing !== snapshot.uncertainty.recentRecallMissing) ctx.addIssue({ code: 'custom', message: 'RECALL_MISMATCH' });
    }
  }
});
export type AdvantageScanSignalSnapshot = z.infer<typeof AdvantageScanSignalSnapshotSchema>;

export function validateAdvantageScanSnapshot(snapshot: unknown): AdvantageScanSignalSnapshot {
  const parsed = AdvantageScanSignalSnapshotSchema.parse(snapshot);
  const result = parsed.scanResult;
  let rebuilt: AdvantageScanSignalSnapshot;
  if (result === null) {
    rebuilt = buildAdvantageScanSnapshot({ status: 'skipped', scanVersion: SCAN_VERSION }, parsed.meta.generatedAt);
  } else {
    // Recover each fixed answer from its retained raw evidence. Uncertain is the
    // only legal absence; replay then verifies every score and derived field.
    const refs = [...Object.values(result.interests), ...Object.values(result.behavior), ...Object.values(result.values)].flatMap(c => c.evidenceIds);
    const answers = FIXED_QUESTIONS.map(q => {
      if (q.questionId === 'Q14') return { questionId: q.questionId, optionId: result.recentEvidence.optionId };
      const matching = refs.filter(ref => ref.startsWith('scan:' + q.questionId + '.'));
      if (matching.length > 1) throw new Error('DUPLICATE_FIXED_EVIDENCE');
      return { questionId: q.questionId, optionId: matching[0]?.slice(5) ?? q.questionId + '.uncertain' };
    });
    const fixed = { scanVersion: SCAN_VERSION, answers };
    rebuilt = buildAdvantageScanSnapshot({ status: 'completed', ...fixed, followups: {
      fixedInputHash: planFollowups(fixed).fixedInputHash,
      answers: result.followups.filter(f => f.optionId !== null).map(f => ({ questionId: f.questionId, optionId: f.optionId })),
      endedByUser: result.followups.some(f => f.status === 'ended_by_user'),
    } }, parsed.meta.generatedAt);
  }
  if (parsed.meta.artifactHash !== semanticHash(parsed) || canonicalSemantic(parsed) !== canonicalSemantic(rebuilt)) throw new Error('SCAN_POLICY_MISMATCH');
  return parsed;
}
