import { z } from 'zod';
import { JobResearchSchema } from './research/schema';
import { MarketResearchSchema } from './research/market-schema';

export const DirectionIdSchema = z.enum(['work', 'industry', 'city', 'collaboration', 'custom']);
export type DirectionId = z.infer<typeof DirectionIdSchema>;
export type FixedDirectionId = Exclude<DirectionId, 'custom'>;
export const QuestionnaireVersionSchema = z.enum(['v1', 'v2']);
export type QuestionnaireVersion = z.infer<typeof QuestionnaireVersionSchema>;

export const QuestionOptionSchema = z.object({ id: z.string().min(1), label: z.string().min(1) });
export const SupplementaryFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  required: z.boolean(),
  maxItems: z.number().int().positive().optional(),
  showWhenOptionId: z.string().min(1).optional(),
});
export const FixedQuestionSchema = z.object({
  id: z.string().min(1),
  directionId: z.enum(['work', 'industry', 'city', 'collaboration']),
  type: z.enum(['single', 'multi', 'text']),
  text: z.string().min(1),
  description: z.string().min(1).optional(),
  options: z.array(QuestionOptionSchema).optional(),
  required: z.boolean(),
  maxSelect: z.number().int().positive().optional(),
  supplementaryField: SupplementaryFieldSchema.optional(),
});
export type FixedQuestion = z.infer<typeof FixedQuestionSchema>;

export const AnswerValueSchema = z.object({
  optionIds: z.array(z.string().min(1)).optional(),
  textValue: z.string().optional(),
  supplementaryValue: z.array(z.string()).optional(),
});
export type AnswerValue = z.infer<typeof AnswerValueSchema>;
export const DeepAnswersSchema = z.record(z.string(), AnswerValueSchema);
export type DeepAnswers = z.infer<typeof DeepAnswersSchema>;

export const DynamicQuestionSchema = z.object({
  id: z.string().regex(/^custom_q[1-5]$/),
  type: z.enum(['single', 'multi']),
  text: z.string().min(2).max(80),
  options: z.array(QuestionOptionSchema).min(2).max(8),
  required: z.literal(true),
  maxSelect: z.number().int().min(1).max(3).optional(),
});
export type DynamicQuestion = z.infer<typeof DynamicQuestionSchema>;

const boundedText = z.string().min(1).max(1_500);
export const WorkDirectionsSchema = z.object({
  groups: z.array(z.object({
    title: z.string().min(1).max(80),
    tags: z.array(z.string().min(1).max(40)).min(3).max(5),
    rationale: z.string().min(1).max(500),
    boundary: z.string().min(1).max(300),
  })).min(2).max(3),
  intersection: z.string().min(1).max(600),
});
export const CityPlanSchema = z.object({
  tiers: z.array(z.object({
    priority: z.number().int().min(1).max(3),
    profile: z.string().min(1).max(200),
    rationale: z.string().min(1).max(500),
    boundary: z.string().min(1).max(400),
  })).length(3).refine((tiers) => new Set(tiers.map((tier) => tier.priority)).size === 3, 'Each priority must appear once'),
  intersection: z.string().min(1).max(600),
});
export const CollaborationPlanSchema = WorkDirectionsSchema.extend({
  scenarios: z.array(z.object({
    title: z.string().min(1).max(80),
    yourRole: z.string().min(1).max(400),
    partnerRole: z.string().min(1).max(400),
    sharedDecision: z.string().min(1).max(400),
    trial: z.string().min(1).max(500),
    redFlags: z.array(z.string().min(1).max(200)).min(1).max(3),
  })).min(2).max(4),
});
export const DeepReportSchema = z.object({
  workDirections: WorkDirectionsSchema.optional(),
  jobResearch: JobResearchSchema.optional(),
  industryDirections: WorkDirectionsSchema.optional(),
  cityPlan: CityPlanSchema.optional(),
  collaborationPlan: CollaborationPlanSchema.optional(),
  marketResearch: MarketResearchSchema.optional(),
  title: z.string().min(1).max(100),
  summary: z.string().min(1).max(2_000),
  keyFindings: z.array(z.string().min(1).max(500)).min(2).max(5),
  cards: z.array(z.object({
    id: z.string().min(1).max(80),
    title: z.string().min(1).max(100),
    summary: z.string().min(1).max(800),
    details: z.array(boundedText).min(1).max(8),
    evidence: z.array(z.string().min(1).max(600)).max(8),
  })).min(2).max(6),
  risks: z.array(z.object({
    title: z.string().min(1).max(100),
    detail: boundedText,
    mitigation: boundedText,
  })).min(1).max(4),
  nextActions: z.array(z.object({
    title: z.string().min(1).max(100),
    detail: boundedText,
    timeframe: z.string().min(1).max(80),
  })).min(2).max(5),
  reflectionQuestions: z.array(z.string().min(1).max(300)).max(4),
  disclaimer: z.string().min(1).max(600),
});
export type DeepReport = z.infer<typeof DeepReportSchema>;
