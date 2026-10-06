import { asciiCompare } from './canonical-hash';
import type { Strength } from './common-schema';
import type { Theme } from './ontology';

export type SelectionCandidate = {
  id: string; theme: Theme; strength: Strength; behaviorCount: number; recentMatch: boolean;
  interestCount: number; eligible: boolean; birthOnly: boolean;
};
export type PreferenceEdge = { section: 'behavior' | 'interests'; winnerThemeId: Theme; loserThemeId: Theme };
export type ExclusionReason = 'birth_only' | 'single_positive_source' | 'display_capacity_limit';
const rank: Record<Strength, number> = { strong: 3, moderate: 2, tentative: 1 };
function compareTier(a: SelectionCandidate, b: SelectionCandidate): number {
  return rank[b.strength] - rank[a.strength] || b.behaviorCount - a.behaviorCount
    || Number(b.recentMatch) - Number(a.recentMatch) || b.interestCount - a.interestCount;
}

function sortTier<T extends SelectionCandidate>(tier: T[], preferences: readonly PreferenceEdge[]): T[] {
  const remaining = new Map(tier.map(item => [item.theme, item]));
  const edges: PreferenceEdge[] = [];
  for (const section of ['behavior', 'interests'] as const) {
    for (const edge of preferences.filter(edge => edge.section === section)) {
      if (!remaining.has(edge.winnerThemeId) || !remaining.has(edge.loserThemeId)) continue;
      if (edges.some(other => other.winnerThemeId === edge.loserThemeId && other.loserThemeId === edge.winnerThemeId)) continue;
      if (!edges.some(other => other.winnerThemeId === edge.winnerThemeId && other.loserThemeId === edge.loserThemeId)) edges.push(edge);
    }
  }
  const result: T[] = [];
  while (remaining.size) {
    const available = [...remaining.keys()].filter(theme => !edges.some(edge => edge.loserThemeId === theme && remaining.has(edge.winnerThemeId))).sort(asciiCompare);
    // Legal V1 plans have at most two edges. A cycle means invalid caller data, not a ranking hint.
    if (!available.length) throw new Error('CYCLIC_FOLLOWUP_PREFERENCES');
    const theme = available[0];
    result.push(remaining.get(theme)!);
    remaining.delete(theme);
  }
  return result;
}
export function sortCandidates<T extends SelectionCandidate>(candidates: readonly T[], edges: readonly PreferenceEdge[]): T[] {
  const sorted = [...candidates].sort((a, b) => compareTier(a, b) || asciiCompare(a.theme, b.theme));
  const result: T[] = [];
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && compareTier(sorted[start], sorted[end]) === 0) end++;
    result.push(...sortTier(sorted.slice(start, end), edges));
    start = end;
  }
  return result;
}
export function partitionCandidates<T extends SelectionCandidate>(candidates: readonly T[], edges: readonly PreferenceEdge[]) {
  if (new Set(candidates.map(c => c.id)).size !== candidates.length || new Set(candidates.map(c => c.theme)).size !== candidates.length) throw new Error('DUPLICATE_SELECTION_CANDIDATE');
  const eligible = sortCandidates(candidates.filter(c => c.eligible && !c.birthOnly), edges);
  const selectedIds = new Set(eligible.slice(0, 5).map(c => c.id));
  const withReason = (item: T, reason: ExclusionReason | null) => ({ ...item, priorityReasonCodes: reason ? [reason] : [] });
  const selected = eligible.slice(0, 5).map(c => withReason(c, null));
  const secondary = [
    ...sortCandidates(candidates.filter(c => !selectedIds.has(c.id) && !c.birthOnly), edges),
    ...sortCandidates(candidates.filter(c => c.birthOnly), edges),
  ].map(c => withReason(c, c.birthOnly ? 'birth_only' : c.eligible ? 'display_capacity_limit' : 'single_positive_source'));
  return { selected, secondary };
}
