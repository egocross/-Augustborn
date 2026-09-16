import type { Report } from '@/lib/gemini/schema';

type ReportViewProps = {
  report: Report;
};

export function ReportView({ report }: ReportViewProps) {
  return (
    <article className="report-view" aria-labelledby="report-title">
      <header className="report-intro">
        <p className="eyebrow">命理简析</p>
        <h1 id="report-title">{report.title}</h1>
        <p className="report-summary">{report.summary}</p>
      </header>

      <div className="report-sections">
        {report.sections.map((section, index) => (
          <section className="report-section" key={`${section.heading}-${index}`}>
            <p className="section-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </p>
            <div>
              <h2>{section.heading}</h2>
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

      <footer className="report-disclaimer">
        <p>{report.disclaimer}</p>
      </footer>
    </article>
  );
}
