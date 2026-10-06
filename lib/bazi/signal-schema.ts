import { z } from 'zod';
import { BoundedTextSchema, HashSchema, IdSchema, TraditionalEvidenceSourceSchema } from '../integrated-report/common-schema';
import { ThemeSchema } from '../integrated-report/ontology';

export const BirthTimeConfidenceSchema = z.enum(['exact', 'approximate_same_shichen', 'cross_shichen', 'unknown']);
export type BirthTimeConfidence = z.infer<typeof BirthTimeConfidenceSchema>;
export const UnavailableReasonSchema = z.enum(['overseas_civil_time_unsupported', 'time_basis_unverified', 'historical_time_basis_unverified', 'sensitivity_unavailable', 'upstream_unavailable']);
export const SupportSchema = z.enum(['supports', 'cautions', 'not_established']);
export type Support = z.infer<typeof SupportSchema>;
export const PrioritySchema = z.enum(['primary', 'secondary']);
export const JudgmentStrengthSchema = z.enum(['within_framework_clear', 'within_framework_tentative', 'insufficient']);
export const LimitationCodeSchema = z.enum(['birth_structure_unavailable', 'time_sensitivity_partial', 'traditional_framework_limitation']);

export const BaziMetaSchema = z.object({
  schemaVersion: IdSchema, inputHash: HashSchema, generatedAt: z.iso.datetime(),
  generatorVersion: IdSchema, modelId: IdSchema.nullable(), provider: z.enum(['sample', 'gemini', 'deterministic']),
  versions: z.object({
    scanVersion: IdSchema.nullable(), scoringVersion: IdSchema.nullable(),
    baziPromptVersion: IdSchema.nullable(), integrationPromptVersion: IdSchema.nullable(),
    chartAlgorithmVersion: IdSchema.nullable(), ontologyVersion: IdSchema,
    evidencePolicyVersion: IdSchema, differencePolicyVersion: IdSchema,
  }).strict(), artifactHash: HashSchema,
}).strict().superRefine((meta, ctx) => {
  if (meta.provider === 'deterministic' && meta.modelId !== null) ctx.addIssue({ code: 'custom', message: 'DETERMINISTIC_MODEL_MUST_BE_NULL' });
});
export type BaziMeta = z.infer<typeof BaziMetaSchema>;

export const ChartVariantReferenceSchema = z.object({
  variantId: IdSchema, chartHash: HashSchema, restrictedSegmentId: IdSchema.nullable(), knownPillars: z.array(IdSchema).min(1).max(8),
}).strict();

export const ThemeAssessmentSchema = z.object({
  support: SupportSchema, pillarDependencies: z.array(IdSchema).max(8), basisRefs: z.array(IdSchema).max(32),
  conditions: BoundedTextSchema, priority: PrioritySchema, constructKey: IdSchema, taskKey: IdSchema, comparableConditionKey: IdSchema,
}).strict();

export const VariantAssessmentSchema = z.object({
  variantId: IdSchema,
  themes: z.object({
    analysis_research: ThemeAssessmentSchema, structure_system: ThemeAssessmentSchema, creative_expression: ThemeAssessmentSchema,
    collaboration_helping: ThemeAssessmentSchema, action_iteration: ThemeAssessmentSchema, influence_persuasion: ThemeAssessmentSchema,
    hands_on_problem_solving: ThemeAssessmentSchema,
  }).strict(),
}).strict();

export const CoreStructureSchema = z.object({
  structureId: IdSchema, variantId: IdSchema, role: z.enum(['core', 'auxiliary']), structureCode: IdSchema,
  basisRefs: z.array(IdSchema).min(1).max(32), explanation: BoundedTextSchema,
}).strict();

export const BaziHypothesisSchema = z.object({
  id: IdSchema, theme: ThemeSchema, support: SupportSchema, pillarDependencies: z.array(IdSchema).max(8),
  basisRefs: z.array(IdSchema).min(1).max(32), conditions: BoundedTextSchema, priority: PrioritySchema,
}).strict();

export const BaziClaimSchema = z.object({
  id: IdSchema, claimKey: IdSchema, support: SupportSchema, pillarDependencies: z.array(IdSchema).max(8),
  basisRefs: z.array(IdSchema).min(1).max(32), conditions: BoundedTextSchema, priority: PrioritySchema,
}).strict();

export const TimeSensitivitySchema = z.object({
  signalId: IdSchema, supportingVariantIds: z.array(IdSchema), cautioningVariantIds: z.array(IdSchema),
  notEstablishedVariantIds: z.array(IdSchema), conditionsMayVary: z.boolean(),
}).strict();

export const BaziSignalSnapshotSchema = z.object({
  kind: z.literal('bazi-signal-v1'), meta: BaziMetaSchema,
  status: z.enum(['available', 'partial', 'unavailable']),
  timeConfidence: BirthTimeConfidenceSchema.nullable(),
  unavailableReason: UnavailableReasonSchema.nullable(),
  chartVariants: z.array(ChartVariantReferenceSchema).max(32),
  variantAssessments: z.array(VariantAssessmentSchema).max(32),
  coreStructures: z.array(CoreStructureSchema),
  advantageHypotheses: z.array(BaziHypothesisSchema),
  driveHypotheses: z.array(BaziClaimSchema),
  workStyleHypotheses: z.array(BaziClaimSchema),
  taskTypeHypotheses: z.array(BaziClaimSchema),
  environmentHypotheses: z.array(BaziClaimSchema),
  judgmentStrength: JudgmentStrengthSchema,
  stableSignals: z.array(IdSchema),
  timeSensitiveSignals: z.array(TimeSensitivitySchema),
  confidenceLimitations: z.array(LimitationCodeSchema),
  limitations: z.array(BoundedTextSchema),
  evidenceSources: z.array(TraditionalEvidenceSourceSchema),
}).strict().superRefine((snapshot, ctx) => {
  if (snapshot.status === 'unavailable') {
    if (snapshot.timeConfidence !== null) ctx.addIssue({ code: 'custom', message: 'UNAVAILABLE_TIME_CONFIDENCE_MUST_BE_NULL' });
    if (snapshot.unavailableReason === null) ctx.addIssue({ code: 'custom', message: 'UNAVAILABLE_REASON_REQUIRED' });
    if (snapshot.judgmentStrength !== 'insufficient') ctx.addIssue({ code: 'custom', message: 'UNAVAILABLE_JUDGMENT_MUST_BE_INSUFFICIENT' });
    const arrays = [snapshot.chartVariants, snapshot.variantAssessments, snapshot.coreStructures, snapshot.advantageHypotheses, snapshot.driveHypotheses, snapshot.workStyleHypotheses, snapshot.taskTypeHypotheses, snapshot.environmentHypotheses, snapshot.stableSignals, snapshot.timeSensitiveSignals, snapshot.evidenceSources];
    if (arrays.some(a => a.length !== 0)) ctx.addIssue({ code: 'custom', message: 'UNAVAILABLE_ARRAYS_MUST_BE_EMPTY' });
    if (snapshot.limitations.length === 0) ctx.addIssue({ code: 'custom', message: 'UNAVAILABLE_LIMITATIONS_REQUIRED' });
  } else {
    if (snapshot.timeConfidence === null) ctx.addIssue({ code: 'custom', message: 'AVAILABLE_TIME_CONFIDENCE_REQUIRED' });
    if (snapshot.unavailableReason !== null) ctx.addIssue({ code: 'custom', message: 'AVAILABLE_REASON_MUST_BE_NULL' });
  }
});
export type BaziSignalSnapshot = z.infer<typeof BaziSignalSnapshotSchema>;
export type BaziHypothesis = z.infer<typeof BaziHypothesisSchema>;
export type VariantAssessment = z.infer<typeof VariantAssessmentSchema>;
export type ThemeAssessment = z.infer<typeof ThemeAssessmentSchema>;
