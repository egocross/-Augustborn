import { z } from 'zod';
import { sortedUnique, stableId } from './canonical-hash';
import { ThemeSchema, type Theme } from './ontology';

export const DIFFERENCE_CODES = {
  interest_behavior_difference: { reasonCode: 'interest_behavior_primary_sets_differ', resolutionCode: 'keep_behavior_priority_preserve_interest' },
  recent_scenario_difference: { reasonCode: 'recent_theme_outside_behavior_primary_set', resolutionCode: 'retain_recent_self_report_preserve_behavior' },
  ambiguous_recent_evidence: { reasonCode: 'recent_action_influence_undifferentiated', resolutionCode: 'defer_action_influence_disambiguation' },
  followup_preference_difference: { reasonCode: 'opposing_cross_section_followup_preferences', resolutionCode: 'prefer_behavior_followup_only_within_tier' },
  priority_divergence: { reasonCode: 'sources_emphasize_different_priorities', resolutionCode: 'prioritize_behavior_keep_birth_hypothesis' },
} as const;

const common = {
  id: z.string().min(1).max(200), themeIds: z.array(ThemeSchema).min(1).max(7),
  evidenceRefs: z.array(z.string().min(1).max(200)).min(1).max(256),
  reasonCode: z.string().min(1).max(200), resolutionCode: z.string().min(1).max(200), isContradiction: z.literal(false),
};

export const DifferenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('interest_behavior_difference'), ...common, leftThemeIds: z.array(ThemeSchema).min(1).max(7), rightThemeIds: z.array(ThemeSchema).min(1).max(7) }).strict(),
  z.object({ kind: z.literal('recent_scenario_difference'), ...common, leftThemeIds: z.array(ThemeSchema).min(1).max(7), rightThemeIds: z.array(ThemeSchema).min(1).max(7) }).strict(),
  z.object({ kind: z.literal('ambiguous_recent_evidence'), ...common }).strict(),
  z.object({ kind: z.literal('followup_preference_difference'), ...common, winnerThemeId: ThemeSchema, loserThemeId: ThemeSchema, triggerEvidenceRefs: z.array(z.string().min(1).max(200)).min(1).max(14) }).strict(),
  z.object({ kind: z.literal('priority_divergence'), ...common, baziPriorityThemeIds: z.array(ThemeSchema).min(1).max(7), behaviorPriorityThemeIds: z.array(ThemeSchema).min(1).max(7), baziEvidenceRefs: z.array(z.string().min(1).max(200)).min(1).max(256), behaviorEvidenceRefs: z.array(z.string().min(1).max(200)).min(1).max(256) }).strict(),
]);
export type Difference = z.infer<typeof DifferenceSchema>;

function differenceId(kind: string, themeIds: Theme[], evidenceRefs: string[]): string {
  return stableId('difference', { kind, themeIds, evidenceRefs });
}

export function interestBehaviorDifference(I: Theme[], B: Theme[], interestEvidence: string[], behaviorEvidence: string[]): Difference {
  const themeIds = sortedUnique([...I, ...B]);
  const evidenceRefs = sortedUnique([...interestEvidence, ...behaviorEvidence]);
  return DifferenceSchema.parse({
    kind: 'interest_behavior_difference', id: differenceId('interest_behavior_difference', themeIds, evidenceRefs),
    themeIds, evidenceRefs, ...DIFFERENCE_CODES.interest_behavior_difference, isContradiction: false,
    leftThemeIds: sortedUnique(I), rightThemeIds: sortedUnique(B),
  });
}

export function recentScenarioDifference(R: Theme, B: Theme[], recentEvidenceId: string, behaviorEvidence: string[]): Difference {
  const themeIds = sortedUnique([R, ...B]);
  const evidenceRefs = sortedUnique([recentEvidenceId, ...behaviorEvidence]);
  return DifferenceSchema.parse({
    kind: 'recent_scenario_difference', id: differenceId('recent_scenario_difference', themeIds, evidenceRefs),
    themeIds, evidenceRefs, ...DIFFERENCE_CODES.recent_scenario_difference, isContradiction: false,
    leftThemeIds: [R], rightThemeIds: sortedUnique(B),
  });
}

export function ambiguousRecentEvidence(recentEvidenceId: string): Difference {
  const themeIds: Theme[] = ['action_iteration', 'influence_persuasion'];
  const evidenceRefs = [recentEvidenceId];
  return DifferenceSchema.parse({
    kind: 'ambiguous_recent_evidence', id: differenceId('ambiguous_recent_evidence', themeIds, evidenceRefs),
    themeIds, evidenceRefs, ...DIFFERENCE_CODES.ambiguous_recent_evidence, isContradiction: false,
  });
}

export function followupPreferenceDifference(themePair: Theme[], winnerThemeId: Theme, loserThemeId: Theme, followupEvidence: string[], triggerEvidenceRefs: string[]): Difference {
  const themeIds = sortedUnique(themePair);
  const evidenceRefs = sortedUnique([...followupEvidence, ...triggerEvidenceRefs]);
  return DifferenceSchema.parse({
    kind: 'followup_preference_difference', id: differenceId('followup_preference_difference', themeIds, evidenceRefs),
    themeIds, evidenceRefs, ...DIFFERENCE_CODES.followup_preference_difference, isContradiction: false,
    winnerThemeId, loserThemeId, triggerEvidenceRefs: sortedUnique(triggerEvidenceRefs),
  });
}

export function priorityDivergence(P: Theme[], B: Theme[], baziEvidence: string[], behaviorEvidence: string[]): Difference {
  const themeIds = sortedUnique([...P, ...B]);
  const evidenceRefs = sortedUnique([...baziEvidence, ...behaviorEvidence]);
  return DifferenceSchema.parse({
    kind: 'priority_divergence', id: differenceId('priority_divergence', themeIds, evidenceRefs),
    themeIds, evidenceRefs, ...DIFFERENCE_CODES.priority_divergence, isContradiction: false,
    baziPriorityThemeIds: sortedUnique(P), behaviorPriorityThemeIds: sortedUnique(B),
    baziEvidenceRefs: sortedUnique(baziEvidence), behaviorEvidenceRefs: sortedUnique(behaviorEvidence),
  });
}
