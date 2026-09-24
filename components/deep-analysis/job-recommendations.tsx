import type { JobResearch } from '@/lib/deep-analysis/research/schema';

export function JobRecommendations({ research }: { research: JobResearch }) {
  // Isolate Google's supplied Search Suggestions HTML from the app, including stored reports.
  const searchDocument = research.searchSuggestionsHtml
    ? `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${research.searchSuggestionsHtml}</body></html>`
    : undefined;
  return <section className="deep-report-block job-recommendations" aria-label="可搜索的职位推荐">
    <div className="job-research-heading">
      <h3>可以从这些职位开始找</h3>
      {research.status !== 'sample' ? <p className="job-checked-at">查询日期 <time dateTime={research.checkedAt}>{new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai' }).format(new Date(research.checkedAt))}</time></p> : null}
    </div>
    <p className="job-research-note">{research.note}</p>
    <div className="job-recommendation-list">{research.recommendations.map((job) => <article className="job-recommendation-card" key={job.title}>
      <h4>{job.title}</h4>
      <p className="job-search-keywords"><span>搜索关键词</span>{job.searchKeywords.join(' / ')}</p>
      <p>{job.fitReason}</p>
      <details className="job-recommendation-details">
        <summary>查看门槛与下一步</summary>
        <dl><dt>需要核对的门槛</dt><dd>{job.entryGap}</dd><dt>先做一个小验证</dt><dd>{job.nextStep}</dd><dt>招聘检索依据</dt><dd>{job.source.excerpt}</dd></dl>
      </details>
      <a className="job-source-link" href={job.source.url} target="_blank" rel="noopener noreferrer" aria-label={`在${job.source.site}查看${job.title}的招聘来源（新窗口）`}>查看招聘实例 · {job.source.site}<span aria-hidden="true">↗</span></a>
    </article>)}</div>
    {searchDocument ? <iframe className="job-search-suggestions" title="Google 搜索建议" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={searchDocument} /> : null}
  </section>;
}
