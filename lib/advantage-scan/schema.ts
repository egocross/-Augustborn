import { z } from 'zod';
import { BoundedTextSchema, HashSchema, MetaSchema, PositiveStrengthSchema, ScanEvidenceSourceSchema } from '../integrated-report/common-schema';
import { ConflictSchema } from '../integrated-report/conflicts';
import { DifferenceSchema } from '../integrated-report/differences';
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
}).strict();
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
}).strict();
export type AdvantageScanSignalSnapshot = z.infer<typeof AdvantageScanSignalSnapshotSchema>;

export function validateAdvantageScanSnapshot(snapshot: unknown): AdvantageScanSignalSnapshot {
  return AdvantageScanSignalSnapshotSchema.parse(snapshot);
}
