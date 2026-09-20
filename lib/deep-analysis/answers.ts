import { QUESTION_BANK_V1 } from './questions';
import { AnswerValueSchema, type DeepAnswers, type FixedDirectionId } from './types';

export type AnswerValidationResult =
  | { success: true; data: DeepAnswers }
  | { success: false; error: string };

export function validateDirectionAnswers(directionId: FixedDirectionId, input: unknown): AnswerValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { success: false, error: '答案格式无效。' };
  }

  const questions = QUESTION_BANK_V1[directionId];
  const source = input as Record<string, unknown>;
  const knownIds = new Set(questions.map((question) => question.id));
  if (Object.keys(source).some((id) => !knownIds.has(id))) {
    return { success: false, error: '包含未知问题。' };
  }

  const normalized: DeepAnswers = {};
  for (const question of questions) {
    const parsed = AnswerValueSchema.safeParse(source[question.id]);
    if (!parsed.success) {
      return { success: false, error: `请完成：${question.text}` };
    }

    const answer = parsed.data;
    if (question.type === 'text') {
      const textValue = answer.textValue?.trim();
      if (question.required && !textValue) {
        return { success: false, error: `请完成：${question.text}` };
      }
      normalized[question.id] = { textValue };
      continue;
    }

    const optionIds = [...new Set(answer.optionIds ?? [])];
    const validOptions = new Set(question.options?.map((option) => option.id) ?? []);
    const expectedCount = question.type === 'single' ? 1 : undefined;
    if ((question.required && optionIds.length === 0) || (expectedCount && optionIds.length !== expectedCount)) {
      return { success: false, error: `请完成：${question.text}` };
    }
    if (optionIds.some((id) => !validOptions.has(id))) {
      return { success: false, error: '包含未知选项。' };
    }
    if (question.maxSelect && optionIds.length > question.maxSelect) {
      return { success: false, error: `此题最多选择 ${question.maxSelect} 项。` };
    }

    const supplementaryValue = answer.supplementaryValue
      ? [...new Set(answer.supplementaryValue.map((value) => value.trim()).filter(Boolean))]
      : undefined;
    if (question.supplementaryField?.maxItems && (supplementaryValue?.length ?? 0) > question.supplementaryField.maxItems) {
      return { success: false, error: `最多填写 ${question.supplementaryField.maxItems} 项。` };
    }
    normalized[question.id] = { optionIds, ...(supplementaryValue ? { supplementaryValue } : {}) };
  }

  return { success: true, data: normalized };
}

export function isDirectionComplete(directionId: FixedDirectionId, answers: unknown): boolean {
  return validateDirectionAnswers(directionId, answers).success;
}
