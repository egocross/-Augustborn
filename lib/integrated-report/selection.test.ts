import { expect, it } from 'vitest';
import { partitionCandidates, type SelectionCandidate } from './selection';
const candidate = (theme: SelectionCandidate['theme'], changes: object = {}): SelectionCandidate => ({ id: theme, theme, strength: 'tentative', behaviorCount: 1, interestCount: 1, recentMatch: false, eligible: true, birthOnly: false, ...changes });
it('uses behavior preference only within a complete tier and drops opposite interest edge', () => {
  const candidates = [candidate('structure_system'), candidate('analysis_research')];
  const result = partitionCandidates(candidates, [
    { section: 'behavior', winnerThemeId: 'analysis_research', loserThemeId: 'structure_system' },
    { section: 'interests', winnerThemeId: 'structure_system', loserThemeId: 'analysis_research' },
  ]);
  expect(result.selected.map(x => x.theme)).toEqual(['analysis_research', 'structure_system']);
  candidates[0].behaviorCount = 2;
  expect(partitionCandidates(candidates, [{ section: 'behavior', winnerThemeId: 'analysis_research', loserThemeId: 'structure_system' }]).selected[0].theme).toBe('structure_system');
});
it('never uses birth support to fill main cards', () => {
  expect(partitionCandidates([candidate('analysis_research', { eligible: false, birthOnly: true })], []).secondary[0].priorityReasonCodes).toEqual(['birth_only']);
});
