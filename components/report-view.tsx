import type { Report } from '@/lib/gemini/schema';

import type { ReactNode } from 'react';

type ReportViewProps = {
  report: Report;
  pending?: boolean;
};

const PRODUCT_DISCLAIMER = '仅供自我探索参考，不构成医疗、法律、财务或职业决策建议。';

/** Heading the model uses for the standalone opening block before the numbered sections. */
const OPENING_HEADING = '开篇';

/**
 * Renders the **bold** runs the prompt asks the model to use, so emphasis shows up
 * as weight instead of literal asterisks in the report text.
 */
export function renderInlineMarkup(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : part,
  );
}

/** Renders a body into separate paragraphs on blank lines, with inline **bold**. */
export function renderParagraphs(text: string): ReactNode[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph, index) => (
      <p className="report-body" key={index}>{renderInlineMarkup(paragraph)}</p>
    ));
}

/** Drops a leading list number the model sometimes copies from the prompt. */
const cleanHeading = (heading: string) => heading.replace(/^\s*\d+\s*[.、．]\s*/, '').trim() || heading;

export function ReportView({ report, pending = false }: ReportViewProps) {
  const first = report.sections[0];
  const hasOpening = first?.heading === OPENING_HEADING;
  const opening = hasOpening ? first : undefined;
  const sections = hasOpening ? report.sections.slice(1) : report.sections;

  return (
    <article className="report-view">
      <div className="report-sections">
        {opening ? (
          <section className="report-opening" aria-label="开篇">
            {renderParagraphs(opening.body)}
            {opening.bullets.length > 0 ? (
              <ul className="report-points">
                {opening.bullets.map((bullet, bulletIndex) => (
                  <li key={`${bullet}-${bulletIndex}`}>{renderInlineMarkup(bullet)}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {sections.map((section, index) => (
          <section className="report-section" id={`report-section-${index + 1}`} key={`${section.heading}-${index}`}>
            <p className="section-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </p>
            <div>
              <h2>{cleanHeading(section.heading)}</h2>
              {renderParagraphs(section.body)}
              {section.bullets.length > 0 ? (
                <ul className="report-points">
                  {section.bullets.map((bullet, bulletIndex) => (
                    <li key={`${bullet}-${bulletIndex}`}>{renderInlineMarkup(bullet)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
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
