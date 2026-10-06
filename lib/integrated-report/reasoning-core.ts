import { explicitOpposition, type Conflict } from './conflicts';
import { priorityDivergence, type Difference } from './differences';
import { sortedUnique, semanticHash } from './canonical-hash';
import { makeMeta, sealArtifact } from './common-schema';
import { behaviorStrength } from './evidence-policy';
import { BEHAVIOR_THEME, INTEREST_THEME, RECENT_THEME, THEME_IDS, type Theme } from './ontology';
import { partitionCandidates, type PreferenceEdge, type SelectionCandidate } from './selection';
import type { IntegratedDecision, IntegratedReasoningCore } from './core-schema';
import { validateAdvantageScanSnapshot, type AdvantageScanSignalSnapshot } from '../advantage-scan/schema';
import { BaziSignalSnapshotSchema, type BaziSignalSnapshot } from '../bazi/signal-schema';

type Relation = 'mixed' | 'aligned' | 'partially_aligned' | 'scan_supported_only' | 'bazi_hypothesis_only' | 'insufficient';
const REASONING_GENERATOR_VERSION = 'deterministic-reasoning-v1';

export type ReasoningInput = { scan: AdvantageScanSignalSnapshot; bazi: BaziSignalSnapshot };

export function buildIntegratedReasoningCore(input: ReasoningInput, generatedAt: string): IntegratedReasoningCore {
  const scan = validateAdvantageScanSnapshot(input.scan);
  const bazi = BaziSignalSnapshotSchema.parse(input.bazi);
  const recentSignal = scan.recentEvidence?.signal ?? null;
  const recentTheme: Theme | null = recentSignal ? RECENT_THEME[recentSignal] : null;
  const behaviorSignals = scan.behaviorSignals;
  const interestSignals = scan.interestSignals;

  const scanInfo = (theme: Theme) => {
    const bSig = behaviorSignals.find(s => BEHAVIOR_THEME[s.dimension] === theme);
    const iSig = interestSignals.find(s => INTEREST_THEME[s.dimension] === theme);
    const behaviorCount = bSig?.raw ?? 0;
    const interestCount = iSig?.raw ?? 0;
    const recentMatch = recentTheme === theme;
    const sourceKinds = sortedUnique([
      ...(behaviorCount >= 1 ? ['scenario_choice'] : []),
      ...(interestCount >= 1 ? ['activity_interest'] : []),
      ...(recentMatch ? ['recent_self_report'] : []),
    ]);
    const evidenceIds = sortedUnique([...bSig?.evidenceIds ?? [], ...iSig?.evidenceIds ?? [], ...(recentMatch && scan.recentEvidence?.evidenceId ? [scan.recentEvidence.evidenceId] : [])]);
    return { behaviorCount, interestCount, recentMatch, sourceKinds, evidenceIds };
  };

  const scanAvailable = scan.status !== 'skipped' && (scan.interestSignals.length > 0 || scan.behaviorSignals.length > 0 || scan.workValues.length > 0 || recentSignal !== null);
  const baziAvailable = (bazi.status === 'available' || bazi.status === 'partial') && (bazi.coreStructures.length > 0 || [...bazi.advantageHypotheses, ...bazi.driveHypotheses, ...bazi.workStyleHypotheses, ...bazi.taskTypeHypotheses, ...bazi.environmentHypotheses].some(h => h.support === 'supports'));
  const availability = (scanAvailable && baziAvailable) ? 'both' : scanAvailable ? 'scan_only' : baziAvailable ? 'bazi_only' : 'insufficient';

  const behaviorRaws = behaviorSignals.map(s => ({ theme: BEHAVIOR_THEME[s.dimension], raw: s.raw }));
  const maxBehaviorRaw = behaviorRaws.length ? Math.max(...behaviorRaws.map(x => x.raw)) : 0;
  const B: Theme[] = maxBehaviorRaw >= 2 ? sortedUnique(behaviorRaws.filter(x => x.raw === maxBehaviorRaw).map(x => x.theme)) : [];
  const P: Theme[] = sortedUnique(bazi.advantageHypotheses.filter(h => h.priority === 'primary').map(h => h.theme));
  const baziEvidenceFor = (themes: Theme[]) => sortedUnique(themes.map(t => bazi.advantageHypotheses.find(h => h.theme === t)?.basisRefs ?? []).flat());
  const behaviorEvidenceFor = (themes: Theme[]) => sortedUnique(themes.map(t => behaviorSignals.find(x => BEHAVIOR_THEME[x.dimension] === t)?.evidenceIds ?? []).flat());

  const differences: Difference[] = [...scan.differences];
  if (P.length && B.length && !P.some(t => B.includes(t))) {
    differences.push(priorityDivergence(P, B, baziEvidenceFor(P), behaviorEvidenceFor(B)));
  }

  const conflicts: Conflict[] = [];
  for (const theme of THEME_IDS) {
    const info = scanInfo(theme);
    if (info.behaviorCount < 2) continue;
    const bSig = behaviorSignals.find(x => BEHAVIOR_THEME[x.dimension] === theme);
    if (!bSig) continue;
    const comparisonKeys = bSig.evidenceIds.map(id => { const optionId = id.slice('scan:'.length); const questionId = optionId.split('.')[0]; return { constructKey: theme, taskKey: theme + ':' + questionId, comparableConditionKey: 'scenario:' + questionId, evidenceId: id }; });
    for (const match of comparisonKeys) {
      const cautionRefs = sortedUnique(bazi.variantAssessments.flatMap(assessment => {
        const ta = assessment.themes[theme];
        return ta.support === 'cautions' && match.constructKey === ta.constructKey && match.taskKey === ta.taskKey && match.comparableConditionKey === ta.comparableConditionKey ? ta.basisRefs : [];
      }));
      if (cautionRefs.length) conflicts.push(explicitOpposition({ themeId: theme, constructKey: match.constructKey, taskKey: match.taskKey, comparableConditionKey: match.comparableConditionKey, baziEvidenceRefs: cautionRefs, behaviorEvidenceRefs: [match.evidenceId] }));
    }
  }
  const conflictThemes = new Set(conflicts.map(c => c.themeId));

  const records: Array<{ theme: Theme; relation: Relation; strength: 'strong' | 'moderate' | 'tentative'; strengthCeiling: 'strong' | 'moderate' | 'tentative'; behaviorCount: number; interestCount: number; recentMatch: boolean; eligible: boolean; birthOnly: boolean; evidenceIds: string[] }> = [];
  for (const theme of THEME_IDS) {
    const info = scanInfo(theme);
    const baziSupport = bazi.advantageHypotheses.some(h => h.theme === theme);
    if (info.sourceKinds.length === 0 && !baziSupport) continue;
    let relation: Relation;
    if (conflictThemes.has(theme)) relation = 'mixed';
    else if (baziSupport && info.sourceKinds.length > 0) {
      const hypothesis = bazi.advantageHypotheses.find(h => h.theme === theme)!;
      const stable = bazi.stableSignals.includes(hypothesis.id);
      relation = (info.behaviorCount >= 2 && stable) ? 'aligned' : 'partially_aligned';
    } else if (info.sourceKinds.length > 0) relation = 'scan_supported_only';
    else relation = 'bazi_hypothesis_only';
    const strength = behaviorStrength(theme, info.behaviorCount, { scheduledCount: 4, answeredCount: 4 });
    const strengthCeiling = theme === 'hands_on_problem_solving' ? 'tentative' : strength;
    const birthOnly = baziSupport && info.sourceKinds.length === 0;
    const eligible = !birthOnly && ((strength === 'strong' || strength === 'moderate') || (strength === 'tentative' && info.sourceKinds.length >= 2));
    const evidenceIds = sortedUnique([...info.evidenceIds, ...(bazi.advantageHypotheses.find(h => h.theme === theme)?.basisRefs ?? [])]);
    records.push({ theme, relation, strength, strengthCeiling, behaviorCount: info.behaviorCount, interestCount: info.interestCount, recentMatch: info.recentMatch, eligible, birthOnly, evidenceIds });
  }

  const preferenceEdges: PreferenceEdge[] = [];
  if (scan.scanResult) {
    for (const f of scan.scanResult.followups) {
      if (f.status === 'resolved' && f.winnerThemeId && f.loserThemeId) preferenceEdges.push({ section: f.section, winnerThemeId: f.winnerThemeId, loserThemeId: f.loserThemeId });
    }
  }
  const candidates: SelectionCandidate[] = records.map(r => ({ id: 'decision:' + r.theme, theme: r.theme, strength: r.strength, behaviorCount: r.behaviorCount, recentMatch: r.recentMatch, interestCount: r.interestCount, eligible: r.eligible, birthOnly: r.birthOnly }));
  const partitioned = partitionCandidates(candidates, preferenceEdges);

  const decisions: IntegratedDecision[] = [];
  let priorityIndex = 0;
  for (const item of [...partitioned.selected, ...partitioned.secondary]) {
    const rec = records.find(r => r.theme === item.theme)!;
    decisions.push({
      id: item.id, theme: rec.theme, relation: rec.relation, strength: rec.strength, strengthCeiling: rec.strengthCeiling,
      evidenceRefs: rec.evidenceIds,
      differenceIds: differences.filter(d => d.themeIds.includes(rec.theme)).map(d => d.id),
      conflictIds: conflicts.filter(c => c.themeId === rec.theme).map(c => c.id),
      priorityIndex: priorityIndex++, priorityReasonCodes: item.priorityReasonCodes, verificationQuestionCode: null,
    });
  }

  const decidedThemes = new Set(records.map(r => r.theme));
  const unknowns = THEME_IDS.filter(t => !decidedThemes.has(t));
  const inputHash = semanticHash({ scanHash: scan.meta.artifactHash, baziHash: bazi.meta.artifactHash });
  const meta = makeMeta('integrated-reasoning-core-v1', inputHash, generatedAt, REASONING_GENERATOR_VERSION);
  return sealArtifact({
    kind: 'integrated-reasoning-core-v1', meta,
    sourceSnapshots: { scan: { hash: scan.meta.artifactHash }, bazi: { hash: bazi.meta.artifactHash } },
    availability, decisions,
    selectedDecisionIds: partitioned.selected.map(c => c.id),
    secondaryDecisionIds: partitioned.secondary.map(c => c.id),
    differences, conflicts, unknowns,
  });
}
