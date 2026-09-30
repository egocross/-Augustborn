import { z } from 'zod';

import { CareerWorkValidationSchema } from '@/lib/deep-analysis/types';

const text = z.string().trim().min(1);
const isoTime = z.iso.datetime();
const emptyAttachments = z.tuple([]);
const httpsUrl = z.url().max(4000).refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, '公开成果链接必须使用 HTTPS，且不能包含账号密码');

export const ValidationStatusSchema = z.enum([
  'created', 'generating_experiment', 'experiment_generation_failed', 'ready', 'in_progress',
  'submitted', 'analyzing', 'analysis_failed', 'completed', 'persistence_degraded', 'capability_expired', 'deleted',
]);

export const ValidationContextSnapshotSchema = z.object({
  version: z.literal(1),
  contextHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceReport: z.object({
    reportId: z.string().uuid(),
    reportVersion: z.number().int().positive().optional(),
    reportHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }),
  career: z.object({ careerId: text, careerName: text, candidateReason: text }),
  workValidation: CareerWorkValidationSchema,
  relevantConstraints: z.object({
    location: z.string().optional(),
    incomeBoundary: z.string().optional(),
    timeCapacity: z.string().optional(),
    educationTolerance: z.string().optional(),
    mobility: z.string().optional(),
    otherBarriers: z.array(z.string()).optional(),
  }),
  relevantCareerCapital: z.object({
    experience: z.array(z.string()), skills: z.array(z.string()), evidence: z.array(z.string()),
  }),
  marketEvidence: z.object({
    marketStatus: z.enum(['verified', 'partial', 'unavailable']),
    locationLabel: z.string(),
    sources: z.array(z.object({
      sourceType: text, sourceName: text, sourceUrl: httpsUrl.optional(),
      retrievedAt: isoTime, fact: text,
    })),
    limitationNote: z.string(),
  }),
  parentResultSummary: z.object({
    parentValidationSessionId: z.string().uuid(),
    validatedQuestion: text,
    status: z.enum(['worth_continuing', 'insufficient_evidence', 'do_not_increase_investment']),
    evidenceSummary: z.array(text), unknowns: z.array(text),
    requestedNextActionType: z.literal('in_product_experiment'),
  }).optional(),
  frozenAt: isoTime,
});
export type ValidationContextSnapshot = z.infer<typeof ValidationContextSnapshotSchema>;

export const CareerExperimentDraftSchema = z.object({
  id: text.max(100),
  version: z.literal(1),
  executionMode: z.enum(['online_work_sample', 'offline_low_risk_experience', 'job_reality_review', 'core_work_awareness']),
  validationQuestion: text.max(500),
  uncertaintyType: z.enum(['work_content', 'task_ability', 'learning_response', 'real_world_feasibility', 'work_experience_feeling']),
  hypothesis: text.max(800), title: text.max(160), scenario: text.max(1500),
  role: text.max(300), objective: text.max(800),
  providedInformation: z.array(text.max(1000)).max(12),
  prerequisites: z.array(text.max(500)).max(10),
  estimatedMinutes: z.number().int().min(20).max(180),
  steps: z.array(text.max(800)).min(1).max(12),
  deliverable: text.max(800),
  rubric: z.array(z.object({ criterion: text.max(200), basicStandard: text.max(500) }).strict()).min(1).max(8),
  referenceStructure: z.array(text.max(500)).max(10),
  limitationNote: z.string().max(1000).optional(),
}).strict();
export type CareerExperimentDraft = z.infer<typeof CareerExperimentDraftSchema>;

export const CareerExperimentSchema = CareerExperimentDraftSchema.extend({
  generatedAt: isoTime,
  generationMetadata: z.object({
    experimentGeneratorVersion: text, experimentPromptVersion: text,
    rubricVersion: text, experimentModelId: text,
  }).strict(),
}).strict();
export type CareerExperiment = z.infer<typeof CareerExperimentSchema>;

export const SubmissionSchema = z.object({
  format: z.literal('markdown'), content: z.string().min(20).max(30_000),
  publicResultUrl: httpsUrl.optional(), attachments: emptyAttachments,
  completedAt: isoTime.optional(),
}).strict();
export type Submission = z.infer<typeof SubmissionSchema>;

export const ReflectionSchema = z.object({
  engagement: z.enum(['time_flew', 'neutral', 'draining']),
  persistence: z.enum(['naturally_continued', 'forced_continue', 'wanted_to_stop']),
  repeatWillingness: z.enum(['willing', 'uncertain', 'unwilling']),
  difficulty: z.enum(['too_easy', 'manageable', 'too_hard']),
  notes: z.string().max(2000).optional(),
}).strict();
export type Reflection = z.infer<typeof ReflectionSchema>;

export const EvidenceItemSchema = z.object({
  dimension: z.enum(['task_performance', 'work_experience_feeling', 'learning_response', 'real_world_feasibility', 'external_feedback']),
  signal: z.enum(['support', 'mixed', 'no_evidence', 'risk']),
  observation: text.max(1000), interpretation: text.max(1000), limitation: text.max(1000),
}).strict();
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const ValidationNextActionSchema = z.object({
  type: z.enum(['in_product_experiment', 'external_validation', 'market_contact', 'bridge_path', 'credential_check', 'real_project', 'pause']),
  title: text.max(200), detail: text.max(1000),
  estimatedMinutes: z.number().int().positive().max(10_080).optional(),
  estimatedTimeLabel: z.string().max(100).optional(),
  cost: text.max(200), canStartInProduct: z.boolean(),
}).strict().refine(
  (action) => action.type === 'in_product_experiment' || !action.canStartInProduct,
  { message: '只有站内实验可开启子会话', path: ['canStartInProduct'] },
);
export type ValidationNextAction = z.infer<typeof ValidationNextActionSchema>;

export const ValidationResultDraftSchema = z.object({
  status: z.enum(['worth_continuing', 'insufficient_evidence', 'do_not_increase_investment']),
  validatedQuestion: text.max(500), evidence: z.array(EvidenceItemSchema).max(12),
  supportingEvidence: z.array(text.max(1000)).max(8),
  riskSignals: z.array(text.max(1000)).max(8),
  unknowns: z.array(text.max(1000)).max(8),
  reasoning: text.max(3000), nextAction: ValidationNextActionSchema,
}).strict();
export type ValidationResultDraft = z.infer<typeof ValidationResultDraftSchema>;

export const ValidationResultSchema = ValidationResultDraftSchema.extend({
  analyzedAt: isoTime,
  generationMetadata: z.object({
    evaluationPromptVersion: text, rubricVersion: text, evaluationModelId: text,
  }).strict(),
}).strict();
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const ValidationGenerationMetadataSchema = z.object({
  experimentGeneratorVersion: z.string().optional(),
  experimentPromptVersion: z.string().optional(),
  evaluationPromptVersion: z.string().optional(),
  rubricVersion: z.string().optional(),
  experimentModelId: z.string().optional(),
  evaluationModelId: z.string().optional(),
}).strict();
export type ValidationGenerationMetadata = z.infer<typeof ValidationGenerationMetadataSchema>;

export const CareerValidationSessionSchema = z.object({
  id: z.string().uuid(), reportId: z.string().uuid(), careerId: text,
  parentValidationSessionId: z.string().uuid().nullable(),
  status: ValidationStatusSchema,
  validationContextSnapshot: ValidationContextSnapshotSchema.nullable(),
  experiment: CareerExperimentSchema.nullable(),
  experimentVersion: z.number().int().positive().nullable(),
  submission: SubmissionSchema.nullable(), reflection: ReflectionSchema.nullable(),
  result: ValidationResultSchema.nullable(),
  generationMetadata: ValidationGenerationMetadataSchema.nullable(),
  revision: z.number().int().positive(),
  operationKind: z.enum(['experiment', 'analysis']).nullable(),
  operationToken: z.string().nullable(), operationLeaseExpiresAt: isoTime.nullable(),
  capabilityIssuedAt: isoTime, capabilityExpiresAt: isoTime,
  retentionExpiresAt: isoTime, createdAt: isoTime, updatedAt: isoTime,
  deletedAt: isoTime.nullable(),
}).strict();
export type CareerValidationSession = z.infer<typeof CareerValidationSessionSchema>;
