import { z } from 'zod';

import {
  CAREER_QUESTIONS,
  CAREER_QUESTIONNAIRE_VERSION,
  getCareerQuestion,
  getVisibleCareerQuestions,
  type CareerQuestion,
} from './career-calibration-questions';

export const CareerDraftAnswerSchema = z.object({
  optionIds: z.array(z.string().min(1)).default([]),
  textValue: z.string().max(200).optional(),
  numericValue: z.number().finite().optional(),
}).strict();

export const CareerDraftAnswersSchema = z.record(z.string(), CareerDraftAnswerSchema);
export type CareerDraftAnswer = z.infer<typeof CareerDraftAnswerSchema>;
export type CareerDraftAnswers = z.infer<typeof CareerDraftAnswersSchema>;

const IncomeSchema = z.object({
  minimumIncomeBand: z.string().min(1),
  minimumIncomeCustom: z.number().int().min(0).max(10_000_000).optional(),
  currency: z.literal('CNY'),
  salaryDropTolerance: z.string().min(1),
  runway: z.string().min(1).optional(),
});

const HardConstraintsSchema = z.object({
  careerStatus: z.string().min(1),
  careerStatusContext: z.string().min(1).max(200).optional(),
  transitionUrgency: z.string().min(1),
  income: IncomeSchema,
  responsibilities: z.array(z.string().min(1)),
  responsibilityContext: z.string().min(1).max(200).optional(),
  location: z.object({
    mobility: z.string().min(1),
    constraints: z.array(z.string().min(1)),
  }),
  transitionCapacity: z.object({
    weeklyHours: z.string().min(1),
    preparationHorizon: z.string().min(1),
    maxBudget: z.string().min(1),
  }),
  restartTolerance: z.string().min(1),
  educationTolerance: z.string().min(1),
  workConstraints: z.array(z.string().min(1)),
  workConstraintContext: z.string().min(1).max(200).optional(),
  incomeModels: z.array(z.string().min(1)),
  employmentTypes: z.array(z.string().min(1)),
  languages: z.array(z.string().min(1)).optional(),
  languageContext: z.string().min(1).max(200).optional(),
});

export const CareerCalibrationSchema = z.object({
  questionnaireVersion: z.literal(CAREER_QUESTIONNAIRE_VERSION),
  hardConstraints: HardConstraintsSchema,
  careerCapital: z.object({
    experience: z.array(z.string().min(1)),
    skills: z.array(z.string().min(1)),
    evidence: z.array(z.string().min(1)),
    custom: z.string().min(1).max(200).optional(),
  }),
  values: z.array(z.string().min(1)).min(1).max(3),
});
export type CareerCalibration = z.infer<typeof CareerCalibrationSchema>;

export type CareerDraftValidationError = {
  questionId: string;
  message: string;
};

export type CareerDraftValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: CareerDraftValidationError[] };

const answerHasSelection = (answer: CareerDraftAnswer | undefined): boolean => Boolean(answer?.optionIds.length);

const validateQuestionAnswer = (
  question: CareerQuestion,
  answer: CareerDraftAnswer | undefined,
): CareerDraftValidationError[] => {
  const errors: CareerDraftValidationError[] = [];
  const optionIds = answer?.optionIds ?? [];
  const allowedOptionIds = new Set(question.options.map((option) => option.id));

  if (question.required && !answerHasSelection(answer)) {
    return [{ questionId: question.id, message: '请选择一个答案' }];
  }
  if (!answer) return errors;

  if (new Set(optionIds).size !== optionIds.length) {
    errors.push({ questionId: question.id, message: '同一选项不能重复选择' });
  }
  if (optionIds.some((optionId) => !allowedOptionIds.has(optionId))) {
    errors.push({ questionId: question.id, message: '答案包含未知选项' });
  }
  if (question.type === 'single' && optionIds.length !== 1) {
    errors.push({ questionId: question.id, message: '该问题只能选择一项' });
  }
  if (question.maxSelections && optionIds.length > question.maxSelections) {
    errors.push({ questionId: question.id, message: `最多选择 ${question.maxSelections} 项` });
  }

  const selectedExclusive = question.exclusiveOptionIds?.filter((optionId) => optionIds.includes(optionId)) ?? [];
  if (selectedExclusive.length > 0 && optionIds.length > 1) {
    errors.push({ questionId: question.id, message: '该选项不能与其他选项同时选择' });
  }

  if (question.other && optionIds.includes(question.other.optionId)) {
    if (question.other.inputType === 'currency') {
      if (
        typeof answer.numericValue !== 'number'
        || !Number.isInteger(answer.numericValue)
        || answer.numericValue < 0
        || answer.numericValue > 10_000_000
      ) {
        errors.push({ questionId: question.id, message: '请输入 0–10000000 元之间的整数金额' });
      }
    } else {
      const text = answer.textValue?.trim() ?? '';
      if (question.other.required && !text) {
        errors.push({ questionId: question.id, message: '请补充说明' });
      }
      if (text.length > question.other.maxLength) {
        errors.push({ questionId: question.id, message: `补充说明不能超过 ${question.other.maxLength} 字` });
      }
    }
  }

  return errors;
};

export function validateCareerDraft(input: CareerDraftAnswers): CareerDraftValidationResult {
  const parsed = CareerDraftAnswersSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        questionId: String(issue.path[0] ?? 'answers'),
        message: issue.message,
      })),
    };
  }

  const answers = parsed.data;
  const errors: CareerDraftValidationError[] = [];
  const knownIds = new Set(CAREER_QUESTIONS.map((question) => question.id));
  const visibleQuestions = getVisibleCareerQuestions(answers);
  const visibleIds = new Set(visibleQuestions.map((question) => question.id));

  for (const questionId of Object.keys(answers)) {
    if (!knownIds.has(questionId)) {
      errors.push({ questionId, message: '答案包含未知问题' });
    } else if (!visibleIds.has(questionId)) {
      errors.push({ questionId, message: '该问题当前不应填写，请返回检查前面的答案' });
    }
  }

  for (const question of visibleQuestions) {
    errors.push(...validateQuestionAnswer(question, answers[question.id]));
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

export class CareerCalibrationValidationError extends Error {
  readonly errors: CareerDraftValidationError[];

  constructor(errors: CareerDraftValidationError[]) {
    super(errors[0]?.message ?? '职业现实校准答案无效');
    this.name = 'CareerCalibrationValidationError';
    this.errors = errors;
  }
}

const selected = (answers: CareerDraftAnswers, questionId: string): string[] =>
  answers[questionId]?.optionIds ?? [];

const selectedOne = (answers: CareerDraftAnswers, questionId: string): string => {
  const value = selected(answers, questionId)[0];
  if (!value) throw new Error(`Missing normalized answer: ${questionId}`);
  return value;
};

const selectedText = (answers: CareerDraftAnswers, questionId: string): string | undefined => {
  const value = answers[questionId]?.textValue?.trim();
  return value || undefined;
};

export function normalizeCareerCalibration(input: CareerDraftAnswers): CareerCalibration {
  const parsedDraft = CareerDraftAnswersSchema.safeParse(input);
  if (!parsedDraft.success) {
    throw new CareerCalibrationValidationError(parsedDraft.error.issues.map((issue) => ({
      questionId: String(issue.path[0] ?? 'answers'),
      message: issue.message,
    })));
  }

  const answers = parsedDraft.data;
  const validation = validateCareerDraft(answers);
  if (!validation.valid) throw new CareerCalibrationValidationError(validation.errors);

  const capitalOptions = selected(answers, 'career_capital')
    .map((optionId) => getCareerQuestion('career_capital')?.options.find((option) => option.id === optionId))
    .filter((option): option is NonNullable<typeof option> => Boolean(option));

  const minimumIncomeBand = selectedOne(answers, 'minimum_income');
  const locationMobility = selectedOne(answers, 'location_mobility');
  const normalized: CareerCalibration = {
    questionnaireVersion: CAREER_QUESTIONNAIRE_VERSION,
    hardConstraints: {
      careerStatus: selectedOne(answers, 'career_status'),
      ...(selectedText(answers, 'career_status') ? { careerStatusContext: selectedText(answers, 'career_status') } : {}),
      transitionUrgency: selectedOne(answers, 'transition_urgency'),
      income: {
        minimumIncomeBand,
        ...(minimumIncomeBand === 'minimum_income_custom'
          ? { minimumIncomeCustom: answers.minimum_income.numericValue }
          : {}),
        currency: 'CNY',
        salaryDropTolerance: selectedOne(answers, 'salary_drop_tolerance'),
        ...(answers.income_runway ? { runway: selectedOne(answers, 'income_runway') } : {}),
      },
      responsibilities: selected(answers, 'responsibilities'),
      ...(selectedText(answers, 'responsibilities')
        ? { responsibilityContext: selectedText(answers, 'responsibilities') }
        : {}),
      location: {
        mobility: locationMobility,
        constraints: selected(answers, 'location_constraints'),
      },
      transitionCapacity: {
        weeklyHours: selectedOne(answers, 'weekly_hours'),
        preparationHorizon: selectedOne(answers, 'preparation_horizon'),
        maxBudget: selectedOne(answers, 'max_budget'),
      },
      restartTolerance: selectedOne(answers, 'restart_tolerance'),
      educationTolerance: selectedOne(answers, 'education_tolerance'),
      workConstraints: selected(answers, 'work_constraints'),
      ...(selectedText(answers, 'work_constraints')
        ? { workConstraintContext: selectedText(answers, 'work_constraints') }
        : {}),
      incomeModels: selected(answers, 'income_models'),
      employmentTypes: selected(answers, 'employment_types'),
      ...(answers.work_languages ? { languages: selected(answers, 'work_languages') } : {}),
      ...(selectedText(answers, 'work_languages')
        ? { languageContext: selectedText(answers, 'work_languages') }
        : {}),
    },
    careerCapital: {
      experience: capitalOptions.filter((option) => option.group === 'experience').map((option) => option.id),
      skills: capitalOptions.filter((option) => option.group === 'skills').map((option) => option.id),
      evidence: capitalOptions.filter((option) => option.group === 'evidence').map((option) => option.id),
      ...(selectedText(answers, 'career_capital') ? { custom: selectedText(answers, 'career_capital') } : {}),
    },
    values: selected(answers, 'career_values'),
  };

  return CareerCalibrationSchema.parse(normalized);
}

const labelFor = (questionId: string, optionId: string): string =>
  getCareerQuestion(questionId)?.options.find((option) => option.id === optionId)?.label ?? optionId;

export function summarizeCareerCalibration(calibration: CareerCalibration): string[] {
  const { hardConstraints, careerCapital, values } = calibration;
  const minimumIncome = hardConstraints.income.minimumIncomeBand === 'minimum_income_custom'
    ? `最低可接受月收入约 ${hardConstraints.income.minimumIncomeCustom?.toLocaleString('zh-CN')} 元`
    : `最低可接受月收入为 ${labelFor('minimum_income', hardConstraints.income.minimumIncomeBand)}`;
  const weeklyHours = hardConstraints.transitionCapacity.weeklyHours === 'weekly_hours_full_time'
    ? '目前可全职投入转型'
    : `每周可投入 ${labelFor('weekly_hours', hardConstraints.transitionCapacity.weeklyHours)}`;
  const summary = [
    `希望在 ${labelFor('transition_urgency', hardConstraints.transitionUrgency)}开始进入新方向`,
    minimumIncome,
    `短期收入变化边界：${labelFor('salary_drop_tolerance', hardConstraints.income.salaryDropTolerance)}`,
    `地点范围：${labelFor('location_mobility', hardConstraints.location.mobility)}`,
    weeklyHours,
    `准备周期：${labelFor('preparation_horizon', hardConstraints.transitionCapacity.preparationHorizon)}`,
    `前期投入：${labelFor('max_budget', hardConstraints.transitionCapacity.maxBudget)}`,
    `重新起步边界：${labelFor('restart_tolerance', hardConstraints.restartTolerance)}`,
  ];

  if (!hardConstraints.responsibilities.includes('responsibility_none')) {
    summary.push(`持续责任：${hardConstraints.responsibilities.map((id) => labelFor('responsibilities', id)).join('、')}`);
  }
  if (!hardConstraints.workConstraints.includes('work_constraint_none')) {
    summary.push(`不能长期接受：${hardConstraints.workConstraints.map((id) => labelFor('work_constraints', id)).join('、')}`);
  }
  const capitalCount = careerCapital.experience.length + careerCapital.skills.length + careerCapital.evidence.length;
  summary.push(capitalCount > 0 ? `已确认 ${capitalCount} 项可迁移职业资本` : '目前未确认明显的可迁移职业资本');
  summary.push(`当前优先级：${values.map((id) => labelFor('career_values', id)).join('、')}`);
  return summary;
}
