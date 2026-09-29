import { z } from 'zod';
import { JobResearchSchema } from './research/schema';
import { MarketResearchSchema } from './research/market-schema';

/** Internal compatibility value for the single career-analysis payment product. */
export const CAREER_DIRECTION_ID = 'work' as const;

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
export const CalibrationSummarySchema = z.object({
  constraints: z.array(z.string().min(1).max(120)).min(1).max(5),
  narrowing: z.string().min(1).max(400),
});

export const DirectionRankSchema = z.object({
  priority: z.enum(['primary', 'secondary', 'watch']),
  title: z.string().min(1).max(60),
  whyKept: z.string().min(1).max(300),
  roleFit: z.array(z.string().min(1).max(60)).min(1).max(5),
  taskFit: z.array(z.string().min(1).max(60)).min(1).max(5),
  notFit: z.array(z.string().min(1).max(60)).min(1).max(5),
});

export const ExcludedDirectionSchema = z.object({
  title: z.string().min(1).max(60),
  reason: z.string().min(1).max(300),
  basis: z.enum(['profile', 'answers', 'both']).optional(),
});

export const WorkSplitSchema = z.object({
  youOwn: z.array(z.string().min(1).max(40)).min(1).max(6),
  partnerOwns: z.array(z.string().min(1).max(40)).max(6),
  note: z.string().min(1).max(200).optional(),
});

export const ValidationPlanSchema = z.object({
  task: z.string().min(1).max(120),
  weeks: z.array(z.object({
    label: z.string().min(1).max(20),
    detail: z.string().min(1).max(200),
  })).min(2).max(5),
  successCriteria: z.array(z.string().min(1).max(120)).min(1).max(5),
  fallbackNote: z.string().min(1).max(200).optional(),
});

export const LegacyDeepReportSchema = z.object({
  workDirections: WorkDirectionsSchema.optional(),
  jobResearch: JobResearchSchema.optional(),
  industryDirections: WorkDirectionsSchema.optional(),
  cityPlan: CityPlanSchema.optional(),
  collaborationPlan: CollaborationPlanSchema.optional(),
  marketResearch: MarketResearchSchema.optional(),
  title: z.string().min(1).max(100),
  calibration: CalibrationSummarySchema.optional(),
  directionRanking: z.array(DirectionRankSchema).min(1).max(5).optional(),
  excludedDirections: z.array(ExcludedDirectionSchema).max(5).optional(),
  workSplit: WorkSplitSchema.optional(),
  validationPlan: ValidationPlanSchema.optional(),
  nextAction: z.object({
    title: z.string().min(1).max(100),
    detail: boundedText,
    timeframe: z.string().min(1).max(80),
  }).optional(),
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
    signal: z.string().min(1).max(200).optional(),
  })).min(1).max(4),
  nextActions: z.array(z.object({
    title: z.string().min(1).max(100),
    detail: boundedText,
    timeframe: z.string().min(1).max(80),
  })).min(2).max(5),
  reflectionQuestions: z.array(z.string().min(1).max(300)).max(4),
  disclaimer: z.string().min(1).max(600),
});

export const CareerEvidenceSourceSchema = z.object({
  title: z.string().min(1).max(300),
  url: z.string().url().max(4000).refine((value) => new URL(value).protocol === 'https:'),
  site: z.string().min(1).max(80),
  excerpt: z.string().min(1).max(1800),
});

export const CareerHypothesisSchema = z.object({
  title: z.string().min(2).max(80),
  tier: z.enum([
    '现在值得优先验证',
    '有潜力，但存在现实门槛',
    '长期可能适合，但目前不宜直接切换',
  ]),
  whyConsidered: z.string().min(1).max(800),
  realityFit: z.string().min(1).max(800),
  largestBarrier: z.string().min(1).max(500),
  transferableAssets: z.array(z.string().min(1).max(200)).max(6),
  mainRisk: z.string().min(1).max(500),
  marketEvidenceSummary: z.string().min(1).max(600),
  evidenceStatus: z.enum(['verified', 'partial', 'unavailable']),
  sourceCount: z.number().int().min(0).max(20),
  sources: z.array(CareerEvidenceSourceSchema).max(5),
  evidenceTypes: z.array(z.enum([
    'baseTendencies', 'hardConstraints', 'careerCapital', 'marketEvidence',
  ])).min(2).max(4),
  minimumCostExperiment: z.string().min(1).max(800),
});

export const CareerReportSchema = z.object({
  kind: z.literal('career-calibration'),
  title: z.string().min(1).max(100),
  summary: z.string().min(1).max(1200),
  realityBoundaries: z.array(z.string().min(1).max(300)).min(3).max(6),
  transferableCapital: z.array(z.object({
    asset: z.string().min(1).max(120),
    application: z.string().min(1).max(500),
  })).max(8),
  careerHypotheses: z.array(CareerHypothesisSchema).min(3).max(5),
  deprioritizedDirections: z.array(z.object({
    title: z.string().min(1).max(80),
    constraintReasons: z.array(z.string().min(1).max(300)).min(1).max(4),
  })).max(3),
  thirtyDayPlan: z.array(z.object({
    title: z.string().min(1).max(100),
    detail: z.string().min(1).max(800),
    timeframe: z.string().min(1).max(80),
  })).min(1).max(3),
  marketStatus: z.enum(['verified', 'partial', 'unavailable', 'sample']),
  disclaimer: z.string().min(1).max(300),
});

export const DeepReportSchema = z.union([CareerReportSchema, LegacyDeepReportSchema]);
export type DeepReport = z.infer<typeof DeepReportSchema>;
export type LegacyDeepReport = z.infer<typeof LegacyDeepReportSchema>;
export type CareerReport = z.infer<typeof CareerReportSchema>;
