import type { DeepAnswers, DirectionId } from '../types';
import { BASE_PROMPT } from './base';
import { CITY_PROMPT } from './city';
import { COLLABORATION_PROMPT } from './collaboration';
import { CUSTOM_PROMPT } from './custom';
import { INDUSTRY_PROMPT } from './industry';
import { WORK_PROMPT } from './work';

const directionPrompts: Record<DirectionId, string> = {
  work: WORK_PROMPT,
  industry: INDUSTRY_PROMPT,
  city: CITY_PROMPT,
  collaboration: COLLABORATION_PROMPT,
  custom: CUSTOM_PROMPT,
};

export type DeepPromptInput = {
  birthProfile: Record<string, unknown>;
  freeReportSummary: { sections: Array<{ heading: string; summary: string; bullets: string[] }> };
  directionId: DirectionId;
  questionnaireVersion: 'v1';
  answers: DeepAnswers;
  optionalContext: string;
  customQuestion: string | null;
  cityContext: Record<string, unknown> | null;
};

export function createDeepPrompt(input: DeepPromptInput): string {
  return `${BASE_PROMPT}\n\ndirection=${input.directionId}\n方向任务：${directionPrompts[input.directionId]}\n用户问题：${input.customQuestion ?? '无'}\n输入数据：${JSON.stringify(input)}`;
}
