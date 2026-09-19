import type { Report } from '@/lib/gemini/schema';

type ReportViewProps = {
  report: Report;
  pending?: boolean;
};

/** Drops a leading list number the model sometimes copies from the prompt. */
const cleanHeading = (heading: string) => heading.replace(/^\s*\d+\s*[.、．]\s*/, '').trim() || heading;

export function ReportView({ report, pending = false }: ReportViewProps) {
  return (
    <article className="report-view">
      <div className="report-sections">
        {report.sections.map((section, index) => (
          <section className="report-section" key={`${section.heading}-${index}`}>
            <p className="section-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </p>
            <div>
              <h2>{cleanHeading(section.heading)}</h2>
              <p>{section.body}</p>
              {section.bullets.length > 0 ? (
                <ul>
                  {section.bullets.map((bullet, bulletIndex) => (
                    <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>
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
          <p>{report.disclaimer}</p>
        </footer>
      )}
    </article>
  );
}
