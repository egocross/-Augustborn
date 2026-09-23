'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDocumentScrollLock } from '@/lib/use-document-scroll-lock';

const ratings = [1, 2, 3, 4, 5];

export function FeedbackForm() {
  const [rating, setRating] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'complete' | 'error'>('idle');
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const confirmationRef = useRef<HTMLParagraphElement | null>(null);

  useDocumentScrollLock(dialogOpen);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    const node = dialogRef.current;
    const focusable = () => Array.from(
      node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
    ).filter((element) => !element.hasAttribute('disabled'));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDialogOpen(false);
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }

      const items = focusable();
      if (items.length === 0) {
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = Boolean(active && node?.contains(active));

      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen && status === 'complete') {
      confirmationRef.current?.focus();
    }
  }, [dialogOpen, status]);

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) {
      return;
    }
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

  // The dialog only opens after a user action, so `document` always exists here.
  const dialog = dialogOpen
    ? createPortal(
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
          ref={dialogRef}
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
      </div>,
      document.body,
    )
    : null;

  if (status === 'complete') {
    return (
      <>
        <p className="feedback-confirmation" ref={confirmationRef} role="status" tabIndex={-1}>
          已提交反馈
        </p>
        {dialog}
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
          <p className="rating-hint">1 分代表不太贴近，5 分代表很贴近。</p>
        </fieldset>

        {status === 'error' ? (
          <p className="form-error" role="alert">反馈暂时无法提交，请稍后再试。</p>
        ) : null}

        <button className="secondary-button" disabled={status === 'submitting' || rating === null} type="submit">
          {status === 'submitting' ? '提交中…' : '提交反馈'}
        </button>
      </form>
    </section>
  );
}
