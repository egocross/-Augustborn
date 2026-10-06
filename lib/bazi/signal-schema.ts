import { z } from 'zod';
import { BoundedTextSchema, HashSchema, IdSchema, TraditionalEvidenceSourceSchema } from '../integrated-report/common-schema';
import { semanticHash, sortedUnique } from '../integrated-report/canonical-hash';
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
  variantId: IdSchema, chartHash: HashSchema, restrictedSegmentId: IdSchema.nullable(), knownPillars: z.array(z.enum(['year', 'month', 'day', 'hour'])).min(1).max(4),
}).strict();

export const ThemeAssessmentSchema = z.object({
  support: SupportSchema, pillarDependencies: z.array(z.enum(['pillar:year', 'pillar:month', 'pillar:day', 'pillar:hour'])).max(4), basisRefs: z.array(IdSchema).max(32),
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
  id: IdSchema, theme: ThemeSchema, support: z.literal('supports'), pillarDependencies: z.array(z.enum(['pillar:year', 'pillar:month', 'pillar:day', 'pillar:hour'])).max(4),
  basisRefs: z.array(IdSchema).min(1).max(32), conditions: BoundedTextSchema, priority: PrioritySchema,
}).strict();

export const BaziClaimSchema = z.object({
  id: IdSchema, claimKey: IdSchema, support: SupportSchema, pillarDependencies: z.array(z.enum(['pillar:year', 'pillar:month', 'pillar:day', 'pillar:hour'])).max(4),
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
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const unique = (ids: string[], label: string) => { if (new Set(ids).size !== ids.length) issue('DUPLICATE_' + label); };
  const variants = new Map(snapshot.chartVariants.map(v => [v.variantId, v]));
  const evidence = new Map(snapshot.evidenceSources.map(e => [e.id, e]));
  const claims = [...snapshot.driveHypotheses, ...snapshot.workStyleHypotheses, ...snapshot.taskTypeHypotheses, ...snapshot.environmentHypotheses];
  const signals = [...snapshot.advantageHypotheses, ...claims];
  unique(snapshot.chartVariants.map(v => v.variantId), 'VARIANT');
  unique(snapshot.variantAssessments.map(v => v.variantId), 'ASSESSMENT');
  unique(snapshot.evidenceSources.map(e => e.id), 'EVIDENCE');
  unique(snapshot.advantageHypotheses.map(h => h.theme), 'THEME');
  unique(signals.map(h => h.id), 'SIGNAL');
  unique(snapshot.coreStructures.map(c => c.structureId), 'STRUCTURE');
  unique([...snapshot.stableSignals, ...snapshot.timeSensitiveSignals.map(s => s.signalId)], 'STABILITY_SIGNAL');
  if (snapshot.meta.schemaVersion !== snapshot.kind) issue('SCHEMA_VERSION_MISMATCH');
  if (snapshot.meta.artifactHash !== semanticHash(snapshot)) issue('ARTIFACT_HASH_MISMATCH');
  if (snapshot.variantAssessments.length !== variants.size || snapshot.variantAssessments.some(v => !variants.has(v.variantId))) issue('VARIANT_COVERAGE_MISMATCH');
  for (const source of snapshot.evidenceSources) if (!variants.has(source.variantId)) issue('UNKNOWN_EVIDENCE_VARIANT');
  const checkRefs = (refs: string[], variantId?: string) => {
    unique(refs, 'BASIS_REF');
    if (refs.some(ref => !evidence.has(ref) || (variantId !== undefined && evidence.get(ref)?.variantId !== variantId))) issue('UNKNOWN_OR_WRONG_VARIANT_BASIS_REF');
  };
  const checkDependencies = (dependencies: string[], variantIds: string[]) => {
    unique(dependencies, 'PILLAR_DEPENDENCY');
    if (snapshot.timeConfidence === 'unknown' && dependencies.includes('pillar:hour')) issue('UNKNOWN_HOUR_DEPENDENCY');
    for (const id of variantIds) {
      const known = variants.get(id)?.knownPillars.map(p => 'pillar:' + p) ?? [];
      if (dependencies.some(p => !known.includes(p))) issue('UNAVAILABLE_PILLAR_DEPENDENCY');
    }
  };
  for (const variant of snapshot.chartVariants) {
    unique(variant.knownPillars, 'KNOWN_PILLAR');
    if (snapshot.timeConfidence === 'unknown' && variant.knownPillars.includes('hour')) issue('UNKNOWN_HOUR_PILLAR');
    for (const role of ['core', 'auxiliary']) if (snapshot.coreStructures.filter(c => c.variantId === variant.variantId && c.role === role).length > 2) issue('STRUCTURE_CAPACITY');
  }
  for (const variant of snapshot.variantAssessments) for (const [theme, assessment] of Object.entries(variant.themes)) {
    if (assessment.constructKey !== theme) issue('THEME_CONSTRUCT_MISMATCH');
    if (assessment.support !== 'not_established' && assessment.basisRefs.length === 0) issue('POSITIVE_OR_CAUTION_BASIS_REQUIRED');
    checkRefs(assessment.basisRefs, variant.variantId);
    checkDependencies(assessment.pillarDependencies, [variant.variantId]);
  }
  for (const structure of snapshot.coreStructures) {
    if (!variants.has(structure.variantId)) issue('UNKNOWN_STRUCTURE_VARIANT');
    checkRefs(structure.basisRefs, structure.variantId);
  }
  for (const signal of signals) {
    checkRefs(signal.basisRefs);
    checkDependencies(signal.pillarDependencies, sortedUnique(signal.basisRefs.flatMap(ref => evidence.get(ref)?.variantId ?? [])));
  }
  for (const h of snapshot.advantageHypotheses) {
    const supporting = snapshot.variantAssessments.filter(v => v.themes[h.theme].support === 'supports');
    const positiveRefs = sortedUnique(supporting.flatMap(v => v.themes[h.theme].basisRefs));
    if (!supporting.length || semanticHash(h.basisRefs.slice().sort()) !== semanticHash(positiveRefs)) issue('HYPOTHESIS_POSITIVE_BASIS_MISMATCH');
    if (h.priority !== (supporting.some(v => v.themes[h.theme].priority === 'primary') ? 'primary' : 'secondary')) issue('HYPOTHESIS_PRIORITY_MISMATCH');
    const stable = snapshot.stableSignals.includes(h.id);
    const sensitivity = snapshot.timeSensitiveSignals.find(s => s.signalId === h.id);
    if (!stable && !sensitivity) issue('MISSING_SIGNAL_STABILITY');
    if (stable && (supporting.length !== variants.size || new Set(supporting.map(v => v.themes[h.theme].conditions)).size !== 1)) issue('FALSE_STABLE_SIGNAL');
    if (sensitivity) {
      for (const [support, ids] of [['supports', sensitivity.supportingVariantIds], ['cautions', sensitivity.cautioningVariantIds], ['not_established', sensitivity.notEstablishedVariantIds]] as const) {
        const expected = snapshot.variantAssessments.filter(v => v.themes[h.theme].support === support).map(v => v.variantId).sort();
        if (semanticHash(ids.slice().sort()) !== semanticHash(expected)) issue('SENSITIVITY_MATRIX_MISMATCH');
      }
      const conditionsVary = new Set(snapshot.variantAssessments.map(v => v.themes[h.theme].conditions)).size > 1;
      if (sensitivity.conditionsMayVary !== conditionsVary) issue('SENSITIVITY_CONDITIONS_MISMATCH');
      if (supporting.length === variants.size && !conditionsVary) issue('FALSE_TIME_SENSITIVITY');
    }
  }
  for (const id of [...snapshot.stableSignals, ...snapshot.timeSensitiveSignals.map(s => s.signalId)]) if (!signals.some(h => h.id === id)) issue('UNKNOWN_STABILITY_SIGNAL');
  for (const sensitivity of snapshot.timeSensitiveSignals) {
    const ids = [...sensitivity.supportingVariantIds, ...sensitivity.cautioningVariantIds, ...sensitivity.notEstablishedVariantIds];
    unique(ids, 'SENSITIVITY_VARIANT');
    if (ids.length !== variants.size || ids.some(id => !variants.has(id))) issue('SENSITIVITY_VARIANT_COVERAGE');
  }
  if (snapshot.status === 'unavailable') {
    if (snapshot.timeConfidence !== null) ctx.addIssue({ code: 'custom', message: 'UNAVAILABLE_TIME_CONFIDENCE_MUST_BE_NULL' });
    if (snapshot.unavailableReason === null) ctx.addIssue({ code: 'custom', message: 'UNAVAILABLE_REASON_REQUIRED' });
    if (snapshot.judgmentStrength !== 'insufficient') ctx.addIssue({ code: 'custom', message: 'UNAVAILABLE_JUDGMENT_MUST_BE_INSUFFICIENT' });
    const arrays = [snapshot.chartVariants, snapshot.variantAssessments, snapshot.coreStructures, snapshot.advantageHypotheses, snapshot.driveHypotheses, snapshot.workStyleHypotheses, snapshot.taskTypeHypotheses, snapshot.environmentHypotheses, snapshot.stableSignals, snapshot.timeSensitiveSignals, snapshot.evidenceSources];
    if (arrays.some(a => a.length !== 0)) ctx.addIssue({ code: 'custom', message: 'UNAVAILABLE_ARRAYS_MUST_BE_EMPTY' });
    if (snapshot.limitations.length === 0) ctx.addIssue({ code: 'custom', message: 'UNAVAILABLE_LIMITATIONS_REQUIRED' });
  } else {
    if (variants.size === 0) issue('AVAILABLE_VARIANTS_REQUIRED');
    if (snapshot.timeConfidence === null) ctx.addIssue({ code: 'custom', message: 'AVAILABLE_TIME_CONFIDENCE_REQUIRED' });
    if (snapshot.unavailableReason !== null) ctx.addIssue({ code: 'custom', message: 'AVAILABLE_REASON_MUST_BE_NULL' });
  }
});
export type BaziSignalSnapshot = z.infer<typeof BaziSignalSnapshotSchema>;
export type BaziHypothesis = z.infer<typeof BaziHypothesisSchema>;
export type VariantAssessment = z.infer<typeof VariantAssessmentSchema>;
export type ThemeAssessment = z.infer<typeof ThemeAssessmentSchema>;
