import { z } from 'zod';

export const SCAN_VERSION = 'advantage-scan-v1.1';
export const DISPLAY_ORDER_VERSION = 'counterbalance-v1';
export const SCORING_VERSION = 'scoring-v1';
export const FOLLOWUP_POLICY_VERSION = 'followup-policy-v1';
export const EVIDENCE_POLICY_VERSION = 'evidence-policy-v1';
export const DIFFERENCE_POLICY_VERSION = 'difference-policy-v1';
export const ONTOLOGY_VERSION = 'seven-theme-v1';
export const THEME_IDS = ['analysis_research', 'structure_system', 'creative_expression', 'collaboration_helping', 'action_iteration', 'influence_persuasion', 'hands_on_problem_solving'] as const;
export const INTEREST_DIMENSIONS = ['realistic', 'investigative', 'artistic', 'social', 'enterprising', 'conventional'] as const;
export const BEHAVIOR_DIMENSIONS = ['investigate', 'structure', 'create', 'execute', 'collaborate', 'influence'] as const;
export const VALUE_DIMENSIONS = ['independence', 'achievement', 'relationships', 'support', 'recognition', 'workingConditions'] as const;
export const RECENT_SIGNALS = ['structure', 'investigate', 'create', 'collaborate', 'execute_influence', 'hands_on'] as const;
export const ThemeSchema = z.enum(THEME_IDS);
export type Theme = z.infer<typeof ThemeSchema>;
export type InterestDimension = typeof INTEREST_DIMENSIONS[number];
export type BehaviorDimension = typeof BEHAVIOR_DIMENSIONS[number];
export type ValueDimension = typeof VALUE_DIMENSIONS[number];
export type RecentSignal = typeof RECENT_SIGNALS[number];
export const INTEREST_THEME: Record<InterestDimension, Theme> = {
  realistic: 'hands_on_problem_solving', investigative: 'analysis_research', artistic: 'creative_expression',
  social: 'collaboration_helping', enterprising: 'influence_persuasion', conventional: 'structure_system',
};
export const BEHAVIOR_THEME: Record<BehaviorDimension, Theme> = {
  investigate: 'analysis_research', structure: 'structure_system', create: 'creative_expression',
  execute: 'action_iteration', collaborate: 'collaboration_helping', influence: 'influence_persuasion',
};
export const RECENT_THEME: Record<RecentSignal, Theme | null> = {
  structure: 'structure_system', investigate: 'analysis_research', create: 'creative_expression',
  collaborate: 'collaboration_helping', execute_influence: null, hands_on: 'hands_on_problem_solving',
};
export const THEME_TASKS: Record<Theme, readonly string[]> = {
  analysis_research: ['查明原因', '比较证据', '分析问题'], structure_system: ['分类信息', '整理流程', '建立规则'],
  creative_expression: ['构思方案', '内容表达', '改造呈现'], collaboration_helping: ['理解需求', '解释问题', '协作支持'],
  action_iteration: ['最小尝试', '交付迭代', '解决卡点'], influence_persuasion: ['争取支持', '协调决策', '推动行动'],
  hands_on_problem_solving: ['工具操作', '实体调试', '实际修整'],
};
export const HANDS_ON_LIMITATION = '当前题库对实际操作型行为覆盖有限，需要后续真实任务或新增情境题验证。';
export const CLAIM_KEYS = [...VALUE_DIMENSIONS, 'evidence_first', 'structure_first', 'alternatives_first', 'prototype_first', 'understand_people_first', 'stakeholder_first'] as const;

/** Distinct question contexts are never silently treated as comparable. */
export function scenarioComparison(questionId: string, theme: Theme) {
  if (!['Q7', 'Q8', 'Q9', 'Q10'].includes(questionId)) throw new Error('NOT_SCENARIO_QUESTION');
  return { constructKey: theme, taskKey: `${theme}:${questionId}`, comparableConditionKey: `scenario:${questionId}` };
}
