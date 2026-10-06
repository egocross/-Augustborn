import { semanticHash } from '../../../lib/integrated-report/canonical-hash';
import { BaziSignalSnapshotSchema, VariantAssessmentSchema, type BaziSignalSnapshot, type ThemeAssessment } from '../../../lib/bazi/signal-schema';
import { THEME_IDS, type Theme } from '../../../lib/integrated-report/ontology';

export const SYNTHETIC_BAZI_VERSION = 'synthetic-fixture-v1';
const GENERATED_AT = '2026-10-06T00:00:00.000Z';
const INPUT_HASH = 'd'.repeat(64);
const ARTIFACT_HASH = 'e'.repeat(64);
const VARIANT_ID = 'variant-1';

export type SyntheticBaziOptions = {
  unavailableReason?: NonNullable<BaziSignalSnapshot['unavailableReason']>;
  stableThemes?: Theme[];
  primaryThemes?: Theme[];
  cautionThemes?: Theme[];
  taskMismatch?: boolean;
  timeSensitiveThemes?: Theme[];
  // Produce an available snapshot whose seven themes are all not_established
  // (no supports, no cautions). Distinct from an unavailable envelope.
  availableEmpty?: boolean;
};

function meta(): BaziSignalSnapshot['meta'] {
  return {
    schemaVersion: 'bazi-signal-v1', inputHash: INPUT_HASH, generatedAt: GENERATED_AT,
    generatorVersion: SYNTHETIC_BAZI_VERSION, modelId: null, provider: 'deterministic',
    versions: { scanVersion: null, scoringVersion: null, baziPromptVersion: null, integrationPromptVersion: null,
      chartAlgorithmVersion: 'chart-v1', ontologyVersion: 'seven-theme-v1', evidencePolicyVersion: 'evidence-policy-v1', differencePolicyVersion: 'difference-policy-v1' },
    artifactHash: ARTIFACT_HASH,
  };
}

function unavailable(reason: NonNullable<BaziSignalSnapshot['unavailableReason']>): BaziSignalSnapshot {
  return {
    kind: 'bazi-signal-v1', meta: meta(), status: 'unavailable', timeConfidence: null, unavailableReason: reason,
    chartVariants: [], variantAssessments: [], coreStructures: [], advantageHypotheses: [], driveHypotheses: [],
    workStyleHypotheses: [], taskTypeHypotheses: [], environmentHypotheses: [],
    judgmentStrength: 'insufficient', stableSignals: [], timeSensitiveSignals: [],
    confidenceLimitations: ['birth_structure_unavailable'], limitations: ['本次不使用出生结构'], evidenceSources: [],
  };
}

function notEstablished(theme: Theme): ThemeAssessment {
  return { support: 'not_established', pillarDependencies: [], basisRefs: [], conditions: '合成依据，仅用于规则测试',
    priority: 'secondary', constructKey: theme, taskKey: theme + ':no_task', comparableConditionKey: 'scenario:no_task' };
}

function supports(theme: Theme, primary: boolean): ThemeAssessment {
  return { support: 'supports', pillarDependencies: ['pillar:year', 'pillar:month'], basisRefs: ['bazi:' + theme + ':support'],
    conditions: '合成依据，仅用于规则测试', priority: primary ? 'primary' : 'secondary', constructKey: theme,
    taskKey: theme + ':no_task', comparableConditionKey: 'scenario:no_task' };
}

function cautions(theme: Theme, mismatch: boolean): ThemeAssessment {
  const suffix = mismatch ? 'OTHER_TASK' : 'Q7';
  return { support: 'cautions', pillarDependencies: [], basisRefs: ['bazi:' + theme + ':caution'],
    conditions: '合成依据，仅用于规则测试', priority: 'secondary', constructKey: theme,
    taskKey: theme + ':' + suffix, comparableConditionKey: 'scenario:' + suffix };
}

function available(options: SyntheticBaziOptions): BaziSignalSnapshot {
  const stable = options.stableThemes ?? [];
  const primary = options.primaryThemes ?? [];
  const cautionList = options.cautionThemes ?? [];
  const timeSensitive = options.timeSensitiveThemes ?? [];
  const supported = [...new Set([...stable, ...primary, ...timeSensitive])];
  const themes = VariantAssessmentSchema.shape.themes.parse(Object.fromEntries(THEME_IDS.map(theme => {
    const assessment = cautionList.includes(theme) ? cautions(theme, options.taskMismatch ?? false)
      : supported.includes(theme) ? supports(theme, primary.includes(theme)) : notEstablished(theme);
    return [theme, assessment];
  })));
  const advantageHypotheses: BaziSignalSnapshot['advantageHypotheses'] = supported.map(theme => ({
    id: 'signal:' + theme, theme, support: 'supports' as const, pillarDependencies: ['pillar:year', 'pillar:month'],
    basisRefs: ['bazi:' + theme + ':support'], conditions: '合成依据，仅用于规则测试', priority: primary.includes(theme) ? 'primary' as const : 'secondary' as const,
  }));
  const evidenceSources = supported.map(theme => ({
    id: 'bazi:' + theme + ':support', sourceKind: 'traditional_structure' as const, variantId: VARIANT_ID, basisRef: 'basis:' + theme, verification: 'traditional_hypothesis' as const,
  })).concat(cautionList.map(theme => ({
    id: 'bazi:' + theme + ':caution', sourceKind: 'traditional_structure' as const, variantId: VARIANT_ID, basisRef: 'basis:' + theme + ':caution', verification: 'traditional_hypothesis' as const,
  })));
  const stableSignals = supported.filter(theme => !timeSensitive.includes(theme)).map(theme => 'signal:' + theme);
  const timeSensitiveSignals = timeSensitive.map(theme => ({ signalId: 'signal:' + theme, supportingVariantIds: [VARIANT_ID], cautioningVariantIds: [], notEstablishedVariantIds: ['variant-2'], conditionsMayVary: true }));
  const snapshot: BaziSignalSnapshot = {
    kind: 'bazi-signal-v1', meta: meta(), status: timeSensitive.length ? 'partial' : 'available',
    timeConfidence: 'exact', unavailableReason: null,
    chartVariants: [{ variantId: VARIANT_ID, chartHash: ARTIFACT_HASH, restrictedSegmentId: null, knownPillars: ['year', 'month', 'day', 'hour'] }],
    variantAssessments: [{ variantId: VARIANT_ID, themes }],
    coreStructures: [], advantageHypotheses, driveHypotheses: [], workStyleHypotheses: [], taskTypeHypotheses: [], environmentHypotheses: [],
    judgmentStrength: 'within_framework_tentative', stableSignals, timeSensitiveSignals,
    confidenceLimitations: [], limitations: ['传统命理解释框架，仅作探索线索'], evidenceSources,
  };
  if (timeSensitive.length) {
    snapshot.chartVariants.push({ ...snapshot.chartVariants[0], variantId: 'variant-2' });
    const second = structuredClone(snapshot.variantAssessments[0]);
    second.variantId = 'variant-2';
    for (const theme of THEME_IDS) {
      if (timeSensitive.includes(theme)) second.themes[theme] = { ...notEstablished(theme), conditions: '合成依据，仅用于规则测试：另一变体未建立' };
      else {
        second.themes[theme].basisRefs = second.themes[theme].basisRefs.map(ref => {
          const source = snapshot.evidenceSources.find(e => e.id === ref)!;
          const id = ref + ':variant-2';
          snapshot.evidenceSources.push({ ...source, id, variantId: 'variant-2' });
          return id;
        });
        const hypothesis = snapshot.advantageHypotheses.find(h => h.theme === theme);
        if (hypothesis) hypothesis.basisRefs.push(...second.themes[theme].basisRefs);
      }
    }
    snapshot.variantAssessments.push(second);
  }
  return snapshot;
}

export function syntheticBazi(options: SyntheticBaziOptions = {}): { fixtureKind: 'synthetic_bazi'; snapshot: BaziSignalSnapshot } {
  const hasAvailableInput = (options.stableThemes?.length ?? 0) + (options.primaryThemes?.length ?? 0) + (options.cautionThemes?.length ?? 0) + (options.timeSensitiveThemes?.length ?? 0) > 0;
  const reason = options.unavailableReason ?? (hasAvailableInput || options.availableEmpty === true ? null : 'upstream_unavailable');
  const snapshot = reason ? unavailable(reason) : available(options);
  snapshot.meta.artifactHash = semanticHash(snapshot);
  return { fixtureKind: 'synthetic_bazi', snapshot: BaziSignalSnapshotSchema.parse(snapshot) };
}
