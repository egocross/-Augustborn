import { z } from 'zod';
import { semanticHash } from './canonical-hash';
import { DIFFERENCE_POLICY_VERSION, EVIDENCE_POLICY_VERSION, ONTOLOGY_VERSION, SCAN_VERSION, SCORING_VERSION, ThemeSchema } from './ontology';

export const BoundedTextSchema = z.string().min(1).max(1000);
export const IdSchema = z.string().min(1).max(200);
export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const StrengthSchema = z.enum(['strong', 'moderate', 'tentative', 'insufficient']);
export const PositiveStrengthSchema = z.enum(['strong', 'moderate', 'tentative']);
export type Strength = z.infer<typeof PositiveStrengthSchema>;
export const RelationSchema = z.enum(['mixed', 'aligned', 'partially_aligned', 'scan_supported_only', 'bazi_hypothesis_only', 'insufficient']);
export const MetaSchema = z.object({
  schemaVersion: IdSchema, inputHash: HashSchema, generatedAt: z.iso.datetime(),
  generatorVersion: IdSchema, modelId: IdSchema.nullable(), provider: z.enum(['sample', 'gemini', 'deterministic']),
  versions: z.object({
    scanVersion: z.literal(SCAN_VERSION).nullable(), scoringVersion: z.literal(SCORING_VERSION).nullable(),
    baziPromptVersion: IdSchema.nullable(), integrationPromptVersion: IdSchema.nullable(), chartAlgorithmVersion: IdSchema.nullable(),
    ontologyVersion: z.literal(ONTOLOGY_VERSION), evidencePolicyVersion: z.literal(EVIDENCE_POLICY_VERSION),
    differencePolicyVersion: z.literal(DIFFERENCE_POLICY_VERSION),
  }).strict(), artifactHash: HashSchema,
}).strict().superRefine((meta, ctx) => {
  if (meta.provider === 'deterministic' && meta.modelId !== null) ctx.addIssue({ code: 'custom', message: 'DETERMINISTIC_MODEL_MUST_BE_NULL' });
});
export type Meta = z.infer<typeof MetaSchema>;
export function makeMeta(schemaVersion: string, inputHash: string, generatedAt: string, generatorVersion: string): Meta {
  return MetaSchema.parse({ schemaVersion, inputHash, generatedAt, generatorVersion, modelId: null, provider: 'deterministic',
    versions: { scanVersion: SCAN_VERSION, scoringVersion: SCORING_VERSION, baziPromptVersion: null, integrationPromptVersion: null,
      chartAlgorithmVersion: null, ontologyVersion: ONTOLOGY_VERSION, evidencePolicyVersion: EVIDENCE_POLICY_VERSION, differencePolicyVersion: DIFFERENCE_POLICY_VERSION },
    artifactHash: '0'.repeat(64) });
}
export function sealArtifact<T extends { meta: Meta }>(value: T): T {
  return { ...value, meta: { ...value.meta, artifactHash: semanticHash(value) } };
}
export const TraditionalEvidenceSourceSchema = z.object({
  id: IdSchema, sourceKind: z.literal('traditional_structure'), variantId: IdSchema, basisRef: IdSchema,
  verification: z.literal('traditional_hypothesis'),
}).strict();
const AnswerEvidenceSchema = z.object({ id: IdSchema, questionId: IdSchema, optionId: IdSchema, verification: z.literal('self_report_unverified') }).strict();
export const FollowupEvidenceSourceSchema = AnswerEvidenceSchema.extend({
  sourceKind: z.literal('followup_preference'), section: z.enum(['interests', 'behavior']), themePairKey: IdSchema,
  winnerThemeId: ThemeSchema, loserThemeId: ThemeSchema, triggerEvidenceRefs: z.array(IdSchema).min(1).max(14),
}).strict();
export const ScanEvidenceSourceSchema = z.discriminatedUnion('sourceKind', [
  AnswerEvidenceSchema.extend({ sourceKind: z.literal('scenario_choice') }).strict(),
  AnswerEvidenceSchema.extend({ sourceKind: z.literal('activity_interest') }).strict(),
  AnswerEvidenceSchema.extend({ sourceKind: z.literal('work_value') }).strict(),
  AnswerEvidenceSchema.extend({ sourceKind: z.literal('recent_self_report') }).strict(),
  FollowupEvidenceSourceSchema,
]);
export type ScanEvidenceSource = z.infer<typeof ScanEvidenceSourceSchema>;
export type FollowupEvidenceSource = z.infer<typeof FollowupEvidenceSourceSchema>;
export const SignalSchema = z.object({
  id: IdSchema, themeOrClaimKey: IdSchema, constructKey: IdSchema, taskKey: IdSchema, comparableConditionKey: IdSchema,
  support: z.enum(['supports', 'cautions', 'not_established']), evidenceIds: z.array(IdSchema).max(256), limitations: z.array(BoundedTextSchema).max(32),
}).strict();
