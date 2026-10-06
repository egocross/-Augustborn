/** Independent, hand-audited expectations from §§15–16 and 30.2; no production imports. */
export const THEMES = {
  research: "analysis_research", structure: "structure_system", creative: "creative_expression",
  collaboration: "collaboration_helping", action: "action_iteration", influence: "influence_persuasion", hands: "hands_on_problem_solving",
};
type Alias = keyof typeof THEMES;
export type ExpectedCore = {
  selected: string[]; secondary: string[]; differenceKinds: string[];
  strength: Record<string, string>; relation: Record<string, string>;
  availability: string; conflicts: number;
};
const ib = "interest_behavior_difference";
const rs = "recent_scenario_difference";
const ar = "ambiguous_recent_evidence";
const fp = "followup_preference_difference";
const pd = "priority_divergence";
function expected(selected: Alias[], secondary: Alias[], differences: string[] = [], strength: Record<string, string> = {}, relation: Record<string, string> = {}, availability = "scan_only", conflicts = 0): ExpectedCore {
  return { selected: selected.map(k => THEMES[k]), secondary: secondary.map(k => THEMES[k]), differenceKinds: differences.sort(), strength, relation, availability, conflicts };
}
const strongResearch = { analysis_research: "strong" };
const dualModerate = { analysis_research: "moderate", structure_system: "moderate" };
export const EXPECTED_CORE: Record<string, ExpectedCore> = {
  G01: expected(["research"], ["structure"], [], strongResearch),
  G02: expected(["research", "structure"], ["collaboration", "creative", "hands"], [ib], dualModerate),
  G03: expected(["research", "structure"], ["creative", "collaboration", "hands"], [ib], dualModerate),
  G04: expected([], [], [], {}, {}, "insufficient"),
  G05: expected(["structure", "research", "creative"], ["action", "collaboration", "hands"]),
  G06: expected(["hands"], ["research", "structure"]),
  G07: expected(["research"], [], [], strongResearch),
  G08: expected(["research", "structure"], ["influence"], [ib, pd], dualModerate, { influence_persuasion: "bazi_hypothesis_only" }, "both"),
  G09: expected(["research"], ["structure", "collaboration", "creative", "hands"], [ib], strongResearch, { analysis_research: "mixed" }, "scan_only", 1),
  G10: expected(["research"], ["structure", "collaboration", "creative", "hands"], [ib], strongResearch),
  G11: expected(["research"], ["structure", "collaboration", "creative", "hands"], [ib], strongResearch),
  G12: expected(["research"], ["structure", "collaboration", "creative", "hands"], [ib], strongResearch),
  G13: expected([], ["creative"], [], {}, { creative_expression: "bazi_hypothesis_only" }, "bazi_only"),
  G14: expected(["structure", "research", "creative"], ["action", "collaboration", "hands"], [], {}, { structure_system: "partially_aligned" }, "both"),
  G15: expected(["hands"], ["research", "structure"], [], {}, { hands_on_problem_solving: "partially_aligned" }, "both"),
  G16: expected(["research", "structure"], ["creative", "collaboration", "hands"], [ib], dualModerate),
  G17: expected(["structure", "research"], [], [], dualModerate),
  G18: expected(["research"], ["structure", "creative", "hands"], [ib], strongResearch),
  G19: expected(["research", "creative"], ["structure", "collaboration", "hands"], [ib, rs], strongResearch),
  G20: expected([], [], [ar]),
  G21: expected(["research", "structure"], ["collaboration", "hands"], [fp], dualModerate),
  G22: expected(["research", "structure"], ["collaboration", "hands"], [], dualModerate),
  G23: expected(["structure", "research"], ["collaboration", "hands"], [], dualModerate),
  G24: expected(["research", "creative"], ["action", "structure", "collaboration", "hands"]),
  G25: expected(["research"], [], [], strongResearch),
  G26: expected(["research", "structure"], ["creative", "collaboration", "hands"], [ib], dualModerate),
  G27: expected(["research"], ["structure", "collaboration", "creative", "hands", "influence"], [ib, pd], strongResearch, { influence_persuasion: "partially_aligned" }, "both"),
  G28: expected(["research"], ["structure", "creative"], [rs, pd], strongResearch, { creative_expression: "partially_aligned" }, "both"),
  G29: expected(["research"], ["structure", "collaboration", "creative", "hands", "influence"], [ib], strongResearch, { analysis_research: "aligned", influence_persuasion: "partially_aligned" }, "both"),
  G30: expected([], ["research"]),
  G31: expected([], ["research"]),
  G32: expected([], ["hands"]),
  G33: expected(["research"], []),
  G34: expected([], ["creative"], [], {}, { creative_expression: "partially_aligned" }, "both"),
  G35: expected(["research", "collaboration", "creative", "structure", "hands"], []),
  G36: expected([], [], [], {}, {}, "insufficient"),
  G37: expected([], [], [], {}, {}, "insufficient"),
  G38: expected([], []),
  G39: expected([], ["action"], [ar]),
  G40: expected(["hands"], []),
};
export const EXPECTED_DIFFERENCE_POLICY: Record<string, { reasonCode: string; resolutionCode: string }> = {
  [ib]: { reasonCode: "interest_behavior_primary_sets_differ", resolutionCode: "keep_behavior_priority_preserve_interest" },
  [rs]: { reasonCode: "recent_theme_outside_behavior_primary_set", resolutionCode: "retain_recent_self_report_preserve_behavior" },
  [ar]: { reasonCode: "recent_action_influence_undifferentiated", resolutionCode: "defer_action_influence_disambiguation" },
  [fp]: { reasonCode: "opposing_cross_section_followup_preferences", resolutionCode: "prefer_behavior_followup_only_within_tier" },
  [pd]: { reasonCode: "sources_emphasize_different_priorities", resolutionCode: "prioritize_behavior_keep_birth_hypothesis" },
};
export const HANDS_ON_LIMITATION = "当前题库对实际操作型行为覆盖有限，需要后续真实任务或新增情境题验证。";
