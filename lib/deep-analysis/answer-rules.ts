/**
 * Options that mean “none / not sure yet”. They contradict every other choice
 * in the same multi-select question, so selecting one clears the rest and
 * selecting a concrete choice clears the placeholder.
 */
export const EXCLUSIVE_OPTION_IDS: ReadonlySet<string> = new Set([
  'work_q3_uncertain',
  'work_q4_none',
  'city_q5_none',
  'collaboration_q4_none',
]);

export type OptionToggleResult =
  | { kind: 'replace'; optionIds: string[] }
  | { kind: 'reject'; message: string };

/** Applies the multi-select limit and the “none of the above” exclusivity rule. */
export function toggleOptionId(
  selected: readonly string[],
  optionId: string,
  options: { exclusiveIds?: ReadonlySet<string>; maxSelect?: number } = {},
): OptionToggleResult {
  const exclusiveIds = options.exclusiveIds ?? EXCLUSIVE_OPTION_IDS;

  if (selected.includes(optionId)) {
    return { kind: 'replace', optionIds: selected.filter((id) => id !== optionId) };
  }

  if (exclusiveIds.has(optionId)) {
    return { kind: 'replace', optionIds: [optionId] };
  }

  const concrete = selected.filter((id) => !exclusiveIds.has(id));
  if (options.maxSelect && concrete.length + 1 > options.maxSelect) {
    return { kind: 'reject', message: `最多选择 ${options.maxSelect} 项` };
  }

  return { kind: 'replace', optionIds: [...concrete, optionId] };
}

/**
 * Splits a free-text list such as “上海、成都” into unique values. Parsing only
 * happens on the way into the answer, so the raw text a user is still typing is
 * never rewritten in the input field.
 */
export function parseSupplementaryValues(raw: string, maxItems?: number): string[] {
  const values = [...new Set(raw.split(/[,，、/\n]/).map((value) => value.trim()).filter(Boolean))];
  return typeof maxItems === 'number' ? values.slice(0, maxItems) : values;
}
