import { z } from 'zod';
import { sortedUnique, stableId } from './canonical-hash';
import { EVIDENCE_POLICY_VERSION, ThemeSchema, type Theme } from './ontology';

export const ConflictSchema = z.object({
  id: z.string().min(1).max(200), kind: z.literal('explicit_opposition'),
  themeId: ThemeSchema, constructKey: z.string().min(1).max(200), taskKey: z.string().min(1).max(200), comparableConditionKey: z.string().min(1).max(200),
  leftEvidenceRefs: z.array(z.string().min(1).max(200)).min(1).max(256), rightEvidenceRefs: z.array(z.string().min(1).max(200)).min(1).max(256),
  leftPolarity: z.enum(['cautions', 'supports']), rightPolarity: z.enum(['cautions', 'supports']),
  reasonCode: z.string().min(1).max(200), resolutionCode: z.string().min(1).max(200), isContradiction: z.literal(true),
}).strict();
export type Conflict = z.infer<typeof ConflictSchema>;

export function explicitOpposition(input: { themeId: Theme; constructKey: string; taskKey: string; comparableConditionKey: string; baziEvidenceRefs: string[]; behaviorEvidenceRefs: string[] }): Conflict {
  const { themeId, constructKey, taskKey, comparableConditionKey, baziEvidenceRefs, behaviorEvidenceRefs } = input;
  return ConflictSchema.parse({
    id: stableId('conflict', { version: EVIDENCE_POLICY_VERSION, themeId, constructKey, taskKey, comparableConditionKey, baziEvidenceRefs: sortedUnique(baziEvidenceRefs), behaviorEvidenceRefs: sortedUnique(behaviorEvidenceRefs) }), kind: 'explicit_opposition',
    themeId, constructKey, taskKey, comparableConditionKey,
    leftEvidenceRefs: sortedUnique(baziEvidenceRefs), rightEvidenceRefs: sortedUnique(behaviorEvidenceRefs),
    leftPolarity: 'cautions', rightPolarity: 'supports',
    reasonCode: 'explicit_opposition', resolutionCode: 'prioritize_behavior_keep_birth_caution', isContradiction: true,
  });
}
