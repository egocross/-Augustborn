'use client';

import { useState } from 'react';

import { toggleOptionId } from '@/lib/deep-analysis/answer-rules';
import type { CareerDraftAnswer } from '@/lib/deep-analysis/career-calibration';
import type { CareerQuestion } from '@/lib/deep-analysis/career-calibration-questions';

export function CareerCalibrationQuestion({
  answer,
  error,
  onChange,
  question,
}: {
  answer: CareerDraftAnswer;
  error?: string | null;
  onChange: (answer: CareerDraftAnswer) => void;
  question: CareerQuestion;
}) {
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const selected = answer.optionIds;
  const exclusiveIds = new Set(question.exclusiveOptionIds ?? []);
  const otherSelected = Boolean(question.other && selected.includes(question.other.optionId));

  function select(optionId: string) {
    if (question.type === 'single') {
      setSelectionError(null);
      onChange({ optionIds: [optionId] });
      return;
    }

    const result = toggleOptionId(selected, optionId, {
      exclusiveIds,
      maxSelect: question.maxSelections,
    });
    if (result.kind === 'reject') {
      setSelectionError(result.message);
      return;
    }
    setSelectionError(null);
    const keepsOther = Boolean(question.other && result.optionIds.includes(question.other.optionId));
    onChange({
      optionIds: result.optionIds,
      ...(keepsOther && typeof answer.textValue === 'string' ? { textValue: answer.textValue } : {}),
      ...(keepsOther && typeof answer.numericValue === 'number' ? { numericValue: answer.numericValue } : {}),
    });
  }

  return (
    <fieldset className="question-content">
      <legend>{question.question}</legend>
      {question.helperText ? <p className="deep-lead">{question.helperText}</p> : null}
      <div className="option-grid" data-layout={question.options.length > 8 ? 'compact' : 'standard'}>
        {question.options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label className={`option-card${checked ? ' selected' : ''}`} key={option.id}>
              <input
                checked={checked}
                name={question.id}
                onChange={() => select(option.id)}
                type={question.type === 'single' ? 'radio' : 'checkbox'}
                value={option.id}
              />
              <span>{option.label}</span>
              {checked ? <small aria-hidden="true">✓ 已选择</small> : null}
            </label>
          );
        })}
      </div>
      {question.other && otherSelected ? (
        <label className="question-other-field">
          <span>{question.other.label}</span>
          <input
            aria-label={question.other.label}
            inputMode={question.other.inputType === 'currency' ? 'numeric' : undefined}
            maxLength={question.other.inputType === 'text' ? question.other.maxLength : undefined}
            onChange={(event) => {
              if (question.other?.inputType === 'currency') {
                const value = event.target.value.trim();
                onChange({ optionIds: selected, ...(value ? { numericValue: Number(value) } : {}) });
              } else {
                onChange({ optionIds: selected, textValue: event.target.value });
              }
            }}
            placeholder={question.other.placeholder}
            type={question.other.inputType === 'currency' ? 'text' : 'text'}
            value={question.other.inputType === 'currency'
              ? (answer.numericValue ?? '')
              : (answer.textValue ?? '')}
          />
        </label>
      ) : null}
      {selectionError ? <p aria-live="polite" className="form-error" role="status">{selectionError}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </fieldset>
  );
}
