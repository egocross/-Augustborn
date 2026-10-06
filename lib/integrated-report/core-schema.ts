import { z } from 'zod';
import { semanticHash } from './canonical-hash';
import { MetaSchema, PositiveStrengthSchema, RelationSchema } from './common-schema';
import { ConflictSchema } from './conflicts';
import { DifferenceSchema } from './differences';
import { ThemeSchema } from './ontology';
import { buildIntegratedReasoningCore, type ReasoningInput } from './reasoning-core';

export const IntegratedDecisionSchema = z.object({
  id: z.string().min(1).max(200), theme: ThemeSchema, relation: RelationSchema,
  strength: PositiveStrengthSchema, strengthCeiling: PositiveStrengthSchema,
  evidenceRefs: z.array(z.string().min(1).max(200)),
  differenceIds: z.array(z.string().min(1).max(200)), conflictIds: z.array(z.string().min(1).max(200)),
  priorityIndex: z.number().int().min(0), priorityReasonCodes: z.array(z.enum(['birth_only', 'single_positive_source', 'display_capacity_limit'])),
  verificationQuestionCode: z.string().min(1).max(200).nullable(),
}).strict();
export type IntegratedDecision = z.infer<typeof IntegratedDecisionSchema>;

export const SourceSnapshotRefsSchema = z.object({
  scan: z.object({ hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  bazi: z.object({ hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
}).strict();

export const IntegratedReasoningCoreSchema = z.object({
  kind: z.literal('integrated-reasoning-core-v1'), meta: MetaSchema,
  sourceSnapshots: SourceSnapshotRefsSchema,
  availability: z.enum(['both', 'scan_only', 'bazi_only', 'insufficient']),
  decisions: z.array(IntegratedDecisionSchema).max(7),
  selectedDecisionIds: z.array(z.string().min(1).max(200)).max(5),
  secondaryDecisionIds: z.array(z.string().min(1).max(200)),
  differences: z.array(DifferenceSchema), conflicts: z.array(ConflictSchema),
  unknowns: z.array(ThemeSchema),
}).strict();
export type IntegratedReasoningCore = z.infer<typeof IntegratedReasoningCoreSchema>;

export function validateIntegratedReasoningCore(core: unknown, inputs: ReasoningInput): IntegratedReasoningCore {
  const parsed = IntegratedReasoningCoreSchema.parse(core);
  const rebuilt = buildIntegratedReasoningCore(inputs, parsed.meta.generatedAt);
  if (parsed.meta.artifactHash !== semanticHash(parsed) || semanticHash(parsed) !== semanticHash(rebuilt)) throw new Error('INTEGRATED_REASONING_POLICY_MISMATCH');
  return parsed;
}
