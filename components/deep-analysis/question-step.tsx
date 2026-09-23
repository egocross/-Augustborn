'use client';

import { useState } from 'react';

import { parseSupplementaryValues, toggleOptionId } from '@/lib/deep-analysis/answer-rules';
import type { AnswerValue, DynamicQuestion, FixedQuestion } from '@/lib/deep-analysis/types';

type Question = FixedQuestion | DynamicQuestion;

type QuestionStepProps = {
  question: Question;
  answer: AnswerValue;
  onChange: (answer: AnswerValue) => void;
  /** Single-choice questions can advance immediately once no extra field is needed. */
  onSingleSelect?: () => void;
};

/** Short option lists get a two-column grid; long sentences stay full width. */
const COMPACT_LAYOUT_MIN_OPTIONS = 6;

const selectionHint = (question: Question) => {
  if (question.type === 'single') return '单选 · 选择最接近的一项';
  if (question.maxSelect) return `多选 · 最多 ${question.maxSelect} 项`;
  return '多选 · 可选择多项';
};

/**
 * Remounting per question keeps per-question UI state (limit warnings, the raw
 * city text) from leaking into the next question.
 */
export function QuestionStep(props: QuestionStepProps) {
  return <QuestionFields key={props.question.id} {...props} />;
}

function QuestionFields({ question, answer, onChange, onSingleSelect }: QuestionStepProps) {
  const [message, setMessage] = useState('');
  const [supplementaryText, setSupplementaryText] = useState(() => (answer.supplementaryValue ?? []).join('、'));
  const selected = answer.optionIds ?? [];
  const optionLayout = (question.options?.length ?? 0) >= COMPACT_LAYOUT_MIN_OPTIONS ? 'compact' : 'standard';
  const supplementaryField = 'supplementaryField' in question ? question.supplementaryField : undefined;
  const showSupplementaryField = supplementaryField
    ? !supplementaryField.showWhenOptionId || selected.includes(supplementaryField.showWhenOptionId)
    : false;

  const updateOption = (id: string, checked: boolean) => {
    if (question.type === 'single') {
      onChange({ ...answer, optionIds: [id] });
      const showsSupplementaryField = Boolean(
        supplementaryField
        && (!supplementaryField.showWhenOptionId || supplementaryField.showWhenOptionId === id),
      );
      if (!showsSupplementaryField) onSingleSelect?.();
      return;
    }

    if (!checked) {
      setMessage('');
      onChange({ ...answer, optionIds: selected.filter((value) => value !== id) });
      return;
    }

    const next = toggleOptionId(selected, id, { maxSelect: question.maxSelect });
    if (next.kind === 'reject') {
      setMessage(next.message);
      return;
    }

    setMessage('');
    onChange({ ...answer, optionIds: next.optionIds });
  };

  if (question.type === 'text') return <div className="question-content">
    <label className="question-title" htmlFor={question.id}>{question.text}</label>
    <textarea id={question.id} maxLength={200} onChange={(event) => onChange({ ...answer, textValue: event.target.value })} rows={4} value={answer.textValue ?? ''} />
  </div>;

  return <fieldset className="question-content">
    <legend className="question-title">{question.text}</legend>
    <div className="question-meta">
      <p className="question-hint">{selectionHint(question)}</p>
      {question.maxSelect ? <p className="question-hint question-counter">已选择 {selected.length} / {question.maxSelect} 项</p> : null}
    </div>
    <div className="option-grid" data-layout={optionLayout}>
      {question.options?.map((option) => <label className="option-card" key={option.id}>
        <input checked={selected.includes(option.id)} name={question.id} onChange={(event) => updateOption(option.id, event.target.checked)} type={question.type === 'single' ? 'radio' : 'checkbox'} />
        <span>{option.label}</span>
      </label>)}
    </div>
    {supplementaryField && showSupplementaryField ? <div className="supplementary-field">
      <label htmlFor={supplementaryField.id}>{supplementaryField.label}</label>
      <input
        id={supplementaryField.id}
        maxLength={200}
        onBlur={() => onChange({ ...answer, supplementaryValue: parseSupplementaryValues(supplementaryText, supplementaryField.maxItems) })}
        onChange={(event) => {
          const raw = event.target.value;
          setSupplementaryText(raw);
          onChange({ ...answer, supplementaryValue: parseSupplementaryValues(raw, supplementaryField.maxItems) });
        }}
        placeholder={supplementaryField.placeholder}
        type="text"
        value={supplementaryText}
      />
      <span className="supplementary-hint">多个城市可以用「、」或逗号分隔。</span>
    </div> : null}
    <p aria-live="polite" className="selection-message" role="status">{message}</p>
  </fieldset>;
}
