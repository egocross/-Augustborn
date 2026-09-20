'use client';

import { useState } from 'react';

import type { AnswerValue, DynamicQuestion, FixedQuestion } from '@/lib/deep-analysis/types';

type Question = FixedQuestion | DynamicQuestion;

export function QuestionStep({ question, answer, onChange }: { question: Question; answer: AnswerValue; onChange: (answer: AnswerValue) => void }) {
  const [message, setMessage] = useState('');
  const selected = answer.optionIds ?? [];
  const supplementaryField = 'supplementaryField' in question ? question.supplementaryField : undefined;
  const updateOption = (id: string, checked: boolean) => {
    if (question.type === 'single') { onChange({ optionIds: [id] }); return; }
    const next = checked ? [...selected, id] : selected.filter((value) => value !== id);
    if (question.maxSelect && next.length > question.maxSelect) { setMessage(`最多选择 ${question.maxSelect} 项`); return; }
    setMessage(''); onChange({ ...answer, optionIds: next });
  };

  if (question.type === 'text') return <div className="question-content">
    <label className="question-title" htmlFor={question.id}>{question.text}</label>
    <textarea id={question.id} maxLength={200} onChange={(event) => onChange({ textValue: event.target.value })} rows={4} value={answer.textValue ?? ''} />
  </div>;

  return <fieldset className="question-content">
    <legend className="question-title">{question.text}</legend>
    {question.maxSelect ? <p className="question-hint">最多选择 {question.maxSelect} 项</p> : null}
    <div className="option-grid">
      {question.options?.map((option) => <label className="option-card" key={option.id}>
        <input checked={selected.includes(option.id)} name={question.id} onChange={(event) => updateOption(option.id, event.target.checked)} type={question.type === 'single' ? 'radio' : 'checkbox'} />
        <span>{option.label}</span>
      </label>)}
    </div>
    {supplementaryField ? <label className="supplementary-field">
      <span>{supplementaryField.label}</span>
      <input
        maxLength={200}
        onChange={(event) => {
          const values = [...new Set(event.target.value.split(/[,，、/\n]/).map((value) => value.trim()).filter(Boolean))]
            .slice(0, supplementaryField.maxItems);
          onChange({ ...answer, supplementaryValue: values });
        }}
        placeholder={supplementaryField.placeholder}
        type="text"
        value={(answer.supplementaryValue ?? []).join('、')}
      />
    </label> : null}
    <p aria-live="polite" className="selection-message" role="status">{message}</p>
  </fieldset>;
}
