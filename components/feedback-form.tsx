'use client';

import { useEffect, useState } from 'react';

const ratings = [1, 2, 3, 4, 5];

export function FeedbackForm() {
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'complete' | 'error'>('idle');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDialogOpen(false);
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [dialogOpen]);

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });

      if (!response.ok) {
        throw new Error('Unable to submit feedback');
      }

      setStatus('complete');
      setDialogOpen(true);
    } catch {
      setStatus('error');
    }
  }

  if (status === 'complete') {
    return (
      <>
        <p className="feedback-confirmation" role="status">已提交反馈</p>
        {dialogOpen ? (
          <div
            className="feedback-success-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setDialogOpen(false);
              }
            }}
            role="presentation"
          >
            <section
              aria-labelledby="feedback-success-heading"
              aria-modal="true"
              className="feedback-success-dialog"
              role="dialog"
            >
              <div aria-hidden="true" className="feedback-success-emoji">😊</div>
              <h2 id="feedback-success-heading">谢谢你的反馈</h2>
              <p>你的评分已收到。</p>
              <button
                autoFocus
                className="primary-button feedback-success-button"
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                完成
              </button>
            </section>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <section className="feedback-panel" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading">这份报告贴近你吗？</h2>
      <form onSubmit={submitFeedback}>
        <fieldset>
          <legend>准确度评分</legend>
          <div className="rating-options">
            {ratings.map((value) => (
              <label key={value}>
                <input
                  checked={rating === value}
                  name="rating"
                  onChange={() => setRating(value)}
                  type="radio"
                  value={value}
                />
                <span>{value} 分</span>
              </label>
            ))}
          </div>
        </fieldset>

        {status === 'error' ? (
          <p className="form-error" role="alert">反馈暂时无法提交，请稍后再试。</p>
        ) : null}

        <button className="secondary-button" disabled={status === 'submitting'} type="submit">
          {status === 'submitting' ? '提交中…' : '提交反馈'}
        </button>
      </form>
    </section>
  );
}
