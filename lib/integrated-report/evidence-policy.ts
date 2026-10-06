import type { ScanEvidenceSource, Strength } from './common-schema';
import { BEHAVIOR_THEME, EVIDENCE_POLICY_VERSION, HANDS_ON_LIMITATION, INTEREST_THEME, RECENT_THEME, type BehaviorDimension, type InterestDimension, type RecentSignal, type Theme } from './ontology';
import { sortedUnique } from './canonical-hash';

export function behaviorStrength(theme: Theme, fixedCount: number, coverage: { scheduledCount: number; answeredCount: number }): Strength {
  if (coverage.scheduledCount !== coverage.answeredCount) throw new Error('BEHAVIOR_FIXED_INCOMPLETE');
  if (!Number.isInteger(fixedCount) || fixedCount < 0 || fixedCount > coverage.scheduledCount) throw new Error('INVALID_BEHAVIOR_COUNT');
  if (theme === 'hands_on_problem_solving') return 'tentative';
  return fixedCount >= 3 ? 'strong' : fixedCount >= 2 ? 'moderate' : 'tentative';
}
export function evidenceTheme(source: ScanEvidenceSource): Theme | null {
  const suffix = source.optionId.split('.')[1];
  switch (source.sourceKind) {
    case 'scenario_choice': return BEHAVIOR_THEME[suffix as BehaviorDimension] ?? null;
    case 'activity_interest': return INTEREST_THEME[suffix as InterestDimension] ?? null;
    case 'recent_self_report': return RECENT_THEME[suffix as RecentSignal] ?? null;
    default: return null;
  }
}
export function positiveScanSourceKinds(theme: Theme, sources: readonly ScanEvidenceSource[]): string[] {
  return sortedUnique(sources.filter(source => evidenceTheme(source) === theme).map(source => source.sourceKind));
}
export function themeLimitations(theme: Theme): string[] { return theme === 'hands_on_problem_solving' ? [HANDS_ON_LIMITATION] : []; }
export function strengthRule(strength: Strength): string { return `${EVIDENCE_POLICY_VERSION}:${strength}`; }
