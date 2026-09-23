import type { Report } from '@/lib/gemini/schema';

type ReportViewProps = {
  report: Report;
  pending?: boolean;
};

const PRODUCT_DISCLAIMER = '仅供自我探索参考，不构成医疗、法律、财务或职业决策建议。';

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
      {sections.length > 1 ? (
        <nav aria-label="报告内容" className="report-outline">
          <p className="report-outline-title">本报告包含</p>
          <ol>
            {sections.map((section, index) => (
              <li key={`${section.heading}-${index}`}>
                <a href={`#report-section-${index + 1}`}>{cleanHeading(section.heading)}</a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

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
                {claim ? <p className="report-claim">{claim}</p> : null}
                {detail ? <p className="report-detail">{detail}</p> : null}
                {section.bullets.length > 0 ? (
                  <ul className="report-points">
                    {section.bullets.map((bullet, bulletIndex) => (
                      <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>
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
