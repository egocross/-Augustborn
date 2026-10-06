import { describe, expect, it } from "vitest";
import { buildAdvantageScanSnapshot } from "../lib/advantage-scan/snapshot";
import { validateAdvantageScanSnapshot } from "../lib/advantage-scan/schema";
import { planFollowups } from "../lib/advantage-scan/followup-selector";
import { buildIntegratedReasoningCore } from "../lib/integrated-report/reasoning-core";
import { validateIntegratedReasoningCore } from "../lib/integrated-report/core-schema";
import { syntheticBazi } from "./fixtures/integrated-advantage/synthetic-bazi";
import { GOLDEN_ANSWERS, GOLDEN_GENERATED_AT, GOLDEN_SCAN_VERSION, goldenAnswers, replaceAnswers, type GoldenAnswers, type BaziCase } from "./fixtures/integrated-advantage/answers";
import { EXPECTED_CORE, EXPECTED_DIFFERENCE_POLICY, HANDS_ON_LIMITATION, THEMES } from "./fixtures/integrated-advantage/expected-core";

function completedInput(f: GoldenAnswers) {
  const fixed = { scanVersion: GOLDEN_SCAN_VERSION, answers: f.answers };
  return { status: "completed" as const, ...fixed, followups: { fixedInputHash: planFollowups(fixed).fixedInputHash, answers: f.followupAnswers, endedByUser: f.endedByUser } };
}
function scanFor(f: GoldenAnswers) {
  return buildAdvantageScanSnapshot(f.status === "skipped" ? { status: "skipped", scanVersion: GOLDEN_SCAN_VERSION } : completedInput(f), f.generatedAt);
}
function baziFor(kind: BaziCase) {
  switch (kind) {
    case "unavailable": return syntheticBazi().snapshot;
    case "overseas": return syntheticBazi({ unavailableReason: "overseas_civil_time_unsupported" }).snapshot;
    case "influence": return syntheticBazi({ stableThemes: ["influence_persuasion"], primaryThemes: ["influence_persuasion"] }).snapshot;
    case "influence_research": return syntheticBazi({ stableThemes: ["influence_persuasion", "analysis_research"], primaryThemes: ["influence_persuasion", "analysis_research"] }).snapshot;
    case "structure": return syntheticBazi({ stableThemes: ["structure_system"] }).snapshot;
    case "hands": return syntheticBazi({ stableThemes: ["hands_on_problem_solving"] }).snapshot;
    case "creative": return syntheticBazi({ stableThemes: ["creative_expression"], primaryThemes: ["creative_expression"] }).snapshot;
    case "caution": return syntheticBazi({ cautionThemes: ["analysis_research"] }).snapshot;
    case "other_task": return syntheticBazi({ cautionThemes: ["analysis_research"], taskMismatch: true }).snapshot;
    case "not_established": return syntheticBazi({ stableThemes: [] }).snapshot;
    case "time_sensitive_creative": return syntheticBazi({ timeSensitiveThemes: ["creative_expression"] }).snapshot;
  }
}
function run(f: GoldenAnswers) {
  const scan = scanFor(f), bazi = baziFor(f.baziCase);
  return { scan, bazi, core: buildIntegratedReasoningCore({ scan, bazi }, f.generatedAt) };
}
function golden(id: string) { return run(goldenAnswers(id)); }
function changed(id: string, changes: Record<string, string>, followupAnswers?: string[]) {
  const f = goldenAnswers(id);
  f.answers = replaceAnswers(f.answers, changes);
  if (followupAnswers) f.followupAnswers = followupAnswers.map(optionId => ({ questionId: optionId.split(".")[0], optionId }));
  return f;
}
function selectedThemes(core: ReturnType<typeof buildIntegratedReasoningCore>) {
  return core.selectedDecisionIds.map(id => core.decisions.find(d => d.id === id)?.theme);
}

describe("§30.2 complete golden corpus", () => {
  it("contains all 40 complete semantic-answer inputs and independent expected records", () => {
    expect(GOLDEN_ANSWERS.map(f => f.id)).toEqual(Array.from({ length: 40 }, (_, i) => `G${String(i + 1).padStart(2, "0")}`));
    expect(Object.keys(EXPECTED_CORE)).toEqual(GOLDEN_ANSWERS.map(f => f.id));
    for (const f of GOLDEN_ANSWERS) {
      expect(f.answers).toHaveLength(f.status === "skipped" ? 0 : 14);
      expect(new Set(f.answers.map(a => a.questionId)).size).toBe(f.answers.length);
      for (const a of [...f.answers, ...f.followupAnswers]) expect(a.optionId.startsWith(`${a.questionId}.`)).toBe(true);
    }
  });
  for (const f of GOLDEN_ANSWERS) it(`${f.id}: exact decisions, partition, grades, relations and differences`, () => {
    const { scan, bazi, core } = run(f);
    const expected = EXPECTED_CORE[f.id];
    expect(selectedThemes(core)).toEqual(expected.selected);
    expect(core.secondaryDecisionIds.map(id => core.decisions.find(d => d.id === id)?.theme)).toEqual(expected.secondary);
    expect(core.decisions.map(d => d.theme)).toEqual([...expected.selected, ...expected.secondary]);
    expect(core.decisions.map(d => d.priorityIndex)).toEqual(core.decisions.map((_, i) => i));
    expect(core.availability).toBe(expected.availability);
    expect(core.conflicts).toHaveLength(expected.conflicts);
    expect(core.differences.map(d => d.kind).sort()).toEqual(expected.differenceKinds);
    for (const d of core.decisions) {
      expect(d.strength).toBe(expected.strength[d.theme] ?? "tentative");
      expect(d.relation).toBe(expected.relation[d.theme] ?? "scan_supported_only");
      const secondary = core.secondaryDecisionIds.includes(d.id);
      const exclusions = d.priorityReasonCodes.filter(c => ["birth_only", "single_positive_source", "display_capacity_limit"].includes(c));
      expect(exclusions).toEqual(secondary ? [d.relation === "bazi_hypothesis_only" ? "birth_only" : "single_positive_source"] : []);
      expect(d.differenceIds).toEqual(core.differences.filter(x => x.themeIds.includes(d.theme)).map(x => x.id));
      expect(d.conflictIds).toEqual(core.conflicts.filter(x => x.themeId === d.theme).map(x => x.id));
    }
    for (const d of core.differences) {
      expect(d).toMatchObject({ ...EXPECTED_DIFFERENCE_POLICY[d.kind], isContradiction: false });
      expect(new Set(d.evidenceRefs).size).toBe(d.evidenceRefs.length);
    }
    expect(() => validateAdvantageScanSnapshot(scan)).not.toThrow();
    expect(() => validateIntegratedReasoningCore(core, { scan, bazi })).not.toThrow();
  });

  it("G01: normalized fixed behavior is 3/4, uncertainty is 2, and birth changes cannot mutate scan", () => {
    const { scan } = golden("G01");
    expect(scan.scanResult?.behavior.investigate).toMatchObject({ raw: 3, scheduledExposure: 4, normalized: { numerator: 3, denominator: 4 } });
    expect(scan.scanResult?.uncertaintyCount).toBe(2);
    expect(scan.scanResult?.followups).toEqual([]);
    const before = structuredClone(scan);
    buildIntegratedReasoningCore({ scan, bazi: baziFor("influence") }, GOLDEN_GENERATED_AT);
    expect(scan).toEqual(before);
  });
  it.each(["G02", "G03", "G16", "G17", "G21", "G22", "G23", "G26"])("%s: followups never increment base 2:2 raw counts", id => {
    expect(golden(id).scan.scanResult?.behavior.investigate.raw).toBe(2);
    expect(golden(id).scan.scanResult?.behavior.structure.raw).toBe(2);
  });
  it("G03/G16/G23/G26: unanswered or uncertain first pair never silently cancels another pair", () => {
    for (const id of ["G03", "G16", "G23"]) {
      const f = golden(id).scan.scanResult?.followups;
      expect(f).toHaveLength(2);
      expect(f?.[1].status).toBe("resolved");
    }
    const stopped = golden("G26").scan.scanResult?.followups;
    expect(stopped?.map(f => ({ questionId: f.questionId, status: f.status, optionId: f.optionId }))).toEqual([
      { questionId: "FB-IS", status: "unresolved", optionId: "FB-IS.uncertain" },
      { questionId: "FI-IA", status: "ended_by_user", optionId: null },
    ]);
  });
  it("G04/G07/G17/G25: low information cannot cap strong or moderate direct behavior", () => {
    for (const id of ["G04", "G07", "G17", "G25"]) expect(golden(id).scan.status).toBe("low_information");
    expect(golden("G07").scan.scanResult?.behavior.investigate.raw).toBe(4);
    const reduced = run(changed("G25", { Q9: "Q9.uncertain" }));
    expect(reduced.core.decisions[0].strength).toBe("moderate");
  });
  it.each(["G06", "G15", "G32", "G40"])("%s: hands-on always retains its tentative ceiling and fixed limitation", id => {
    const { scan, core } = golden(id);
    const hypothesis = scan.derivedAdvantageHypotheses.find(h => h.theme === THEMES.hands);
    expect(hypothesis).toMatchObject({ strength: "tentative", strengthCeiling: "tentative" });
    expect(hypothesis?.limitations).toContain(HANDS_ON_LIMITATION);
    expect(core.decisions.find(d => d.theme === THEMES.hands)?.strengthCeiling).toBe("tentative");
  });
  it("G12: overseas synthetic unavailable contains no birth observations", () => {
    const { bazi, core } = golden("G12");
    expect(bazi.timeConfidence).toBeNull();
    expect(bazi.unavailableReason).toBe("overseas_civil_time_unsupported");
    expect(bazi.evidenceSources).toEqual([]);
    expect(bazi.advantageHypotheses).toEqual([]);
    expect(core.conflicts).toEqual([]);
  });
  it("G24: displayed A means four different behavior dimensions and three values", () => {
    const { scan } = golden("G24");
    expect(scan.scanResult?.behavior.investigate.raw).toBe(1);
    expect(scan.scanResult?.behavior.structure.raw).toBe(1);
    expect(scan.scanResult?.behavior.create.raw).toBe(1);
    expect(scan.scanResult?.behavior.execute.raw).toBe(1);
    expect(scan.scanResult?.values.independence.raw).toBe(1);
    expect(scan.scanResult?.values.relationships.raw).toBe(1);
    expect(scan.scanResult?.values.recognition.raw).toBe(1);
  });
  it("G36/G37/G38: none, skipped and value-only remain distinct", () => {
    const none = golden("G36").scan, skipped = golden("G37").scan;
    expect(none.recentEvidence).toEqual({ optionId: "Q14.none", signal: null, evidenceId: null, verification: "self_report_unverified" });
    expect(none.scanResult?.recentEvidence).toEqual(none.recentEvidence);
    expect(none.scanResult?.recentRecallMissing).toBe(true);
    expect(none.uncertainty.recentRecallMissing).toBe(true);
    expect(none.evidenceSources.filter(e => e.sourceKind === "recent_self_report")).toEqual([]);
    expect(none.scanResult?.uncertaintyCount).toBe(13);
    expect(skipped.scanResult).toBeNull(); expect(skipped.recentEvidence).toBeNull();
    expect(skipped.uncertainty.recentRecallMissing).toBeNull();
    expect(skipped.meta.inputHash).not.toBe(none.meta.inputHash);
    expect(skipped.meta.artifactHash).not.toBe(none.meta.artifactHash);
    expect(golden("G38").scan.workValues.length).toBeGreaterThan(0);
    expect(golden("G38").scan.behaviorSignals).toEqual([]);
  });
});
