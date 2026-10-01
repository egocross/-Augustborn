import { CAREER_QUESTIONS } from './career-calibration-questions';

export type CareerCapitalGroups = {
  experience: string[];
  skills: string[];
  evidence: string[];
};

const UNKNOWN_CAPITAL_LABEL = '其他已确认的积累';

const CAPITAL_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  (CAREER_QUESTIONS.find((question) => question.id === 'career_capital')?.options ?? [])
    .map((option) => [option.id, option.label]),
);

/**
 * Career capital is stored as stable option ids. Nothing user-facing or model-facing
 * may see those ids, so every render point must go through this label mapping.
 */
export function careerCapitalLabel(optionId: string): string {
  return CAPITAL_LABELS[optionId] ?? UNKNOWN_CAPITAL_LABEL;
}

export function localizeCareerCapital(capital: CareerCapitalGroups): CareerCapitalGroups {
  return {
    experience: capital.experience.map(careerCapitalLabel),
    skills: capital.skills.map(careerCapitalLabel),
    evidence: capital.evidence.map(careerCapitalLabel),
  };
}
