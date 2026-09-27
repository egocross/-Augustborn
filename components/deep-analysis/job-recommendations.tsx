import type { JobResearch } from '@/lib/deep-analysis/research/schema';

/** Strips recruiting-site posting codes like “内容策划(A38503)” for display only. */
const cleanJobTitle = (title: string) => title.replace(/\s*[（(][A-Za-z0-9_-]{3,20}[)）]\s*$/, '').trim() || title;

export function JobRecommendations({ research }: { research: JobResearch }) {
  return <section className="deep-report-block job-recommendations" aria-label="可搜索的职位推荐">
    <div className="job-research-heading">
      <h3>可以从这些职位开始找</h3>
      {research.status !== 'sample' ? <p className="job-checked-at">查询日期 <time dateTime={research.checkedAt}>{new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai' }).format(new Date(research.checkedAt))}</time></p> : null}
    </div>
    <p className="job-research-note">{research.note}</p>
    <div className="job-recommendation-list">{research.recommendations.map((job) => <article className="job-recommendation-card" key={job.title}>
      <h4>{cleanJobTitle(job.title)}</h4>
      {job.coreWork ? <p className="job-core-work"><span>核心工作</span>{job.coreWork}</p> : null}
      {job.dailyTasks?.length ? <div className="job-daily"><p className="job-field-label">日常主要工作</p><ul>{job.dailyTasks.map((task) => <li key={task}>{task}</li>)}</ul></div> : null}
      {job.fitParts?.length ? <div className="job-fit"><p className="job-field-label">适合你的部分</p><ul>{job.fitParts.map((part) => <li key={part}>{part}</li>)}</ul></div> : null}
      <p className="job-search-keywords"><span>搜索关键词</span>{job.searchKeywords.join(' / ')}</p>
      <p>{job.fitReason}</p>
      {job.risk ? <p className="job-risk"><b>潜在风险：</b>{job.risk}</p> : null}
      <details className="job-recommendation-details">
        <summary>查看门槛与下一步</summary>
        <dl><dt>需要核对的门槛</dt><dd>{job.entryGap}</dd><dt>先做一个小验证</dt><dd>{job.nextStep}</dd><dt>招聘检索依据</dt><dd>{job.source.excerpt}</dd></dl>
      </details>
      <a className="job-source-link" href={job.source.url} target="_blank" rel="noopener noreferrer" aria-label={`在${job.source.site}查看${cleanJobTitle(job.title)}的招聘来源（新窗口）`}>查看招聘实例 · {job.source.site}<span aria-hidden="true">↗</span></a>
    </article>)}</div>
  </section>;
}
