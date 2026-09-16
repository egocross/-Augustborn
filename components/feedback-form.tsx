'use client';

import { useState } from 'react';

const ratings = [1, 2, 3, 4, 5];

export function FeedbackForm() {
  const [rating, setRating] = useState(5);
  const [wantsDeepAnalysis, setWantsDeepAnalysis] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'complete' | 'error'>('idle');

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, wantsDeepAnalysis }),
      });

      if (!response.ok) {
        throw new Error('Unable to submit feedback');
      }

      setStatus('complete');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'complete') {
    return <p className="feedback-confirmation" role="status">感谢你的反馈。</p>;
  }

  return (
    <section className="feedback-panel" aria-labelledby="feedback-heading">
      <p className="eyebrow">读后感</p>
      <h2 id="feedback-heading">这份解读贴近你吗？</h2>
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

        <label className="checkbox-label">
          <input
            checked={wantsDeepAnalysis}
            onChange={(event) => setWantsDeepAnalysis(event.target.checked)}
            type="checkbox"
          />
          愿意继续深度分析
        </label>

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
