import type { Report } from '@/lib/gemini/schema';

import type { ReactNode } from 'react';

type ReportViewProps = {
  report: Report;
  pending?: boolean;
};

const PRODUCT_DISCLAIMER = '仅供自我探索参考，不构成医疗、法律、财务或职业决策建议。';

/**
 * Renders the **bold** runs the prompt asks the model to use, so emphasis shows up
 * as weight instead of literal asterisks in the report text.
 */
export function renderInlineMarkup(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : part,
  );
}

/** Drops a leading list number the model sometimes copies from the prompt. */
const cleanHeading = (heading: string) => heading.replace(/^\s*\d+\s*[.、．]\s*/, '').trim() || heading;

/**
 * Separates the opening judgement from its explanation so a reader can scan the
 * conclusion without reading every sentence. Falls back to plain text when the
 * model does not open with a short sentence.
 */
export function splitSectionBody(body: string): { claim: string; detail: string } {
  const match = body.trim().match(/^([^。！？]{8,90}[。！？])\s*([\s\S]*)$/);
  if (!match) {
    return { claim: '', detail: body };
  }
  return { claim: match[1], detail: match[2].trim() };
}

export function ReportView({ report, pending = false }: ReportViewProps) {
  const sections = report.sections;

  return (
    <article className="report-view">
      <div className="report-sections">
        {sections.map((section, index) => {
          const { claim, detail } = splitSectionBody(section.body);

          return (
            <section className="report-section" id={`report-section-${index + 1}`} key={`${section.heading}-${index}`}>
              <p className="section-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </p>
              <div>
                <h2>{cleanHeading(section.heading)}</h2>
                {claim ? <p className="report-claim">{renderInlineMarkup(claim)}</p> : null}
                {detail ? <p className="report-detail">{renderInlineMarkup(detail)}</p> : null}
                {section.bullets.length > 0 ? (
                  <ul className="report-points">
                    {section.bullets.map((bullet, bulletIndex) => (
                      <li key={`${bullet}-${bulletIndex}`}>{renderInlineMarkup(bullet)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {pending ? (
        <div className="report-pending" role="status">
          <div aria-hidden="true" className="skeleton">
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-line-short" />
          </div>
          <p>正在继续生成…</p>
        </div>
      ) : (
        <footer className="report-disclaimer">
          <p>{PRODUCT_DISCLAIMER}</p>
        </footer>
      )}
    </article>
  );
}
