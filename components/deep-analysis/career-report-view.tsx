import type { CareerReport } from '@/lib/deep-analysis/types';

const evidenceLabels: Record<CareerReport['careerHypotheses'][number]['evidenceStatus'], string> = {
  verified: '多条来源支持',
  partial: '部分来源支持',
  unavailable: '市场可行性待验证',
};

export function CareerReportView({ report }: { report: CareerReport }) {
  return (
    <article className="deep-report-view career-report-view">
      <header className="deep-report-hero">
        <p className="eyebrow">职业专项报告</p>
        <h2>{report.title}</h2>
        <p>{report.summary}</p>
      </header>

      <section className="deep-report-block career-boundaries">
        <h3>你的现实职业边界</h3>
        <ul>{report.realityBoundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}</ul>
      </section>

      <section className="deep-report-block career-capital-report">
        <h3>你的可迁移职业资本</h3>
        {report.transferableCapital.length ? (
          <dl>{report.transferableCapital.map((item) => (
            <div key={`${item.asset}-${item.application}`}>
              <dt>{item.asset}</dt>
              <dd>{item.application}</dd>
            </div>
          ))}</dl>
        ) : <p>目前没有确认足够明确的可迁移职业资本；进入新方向时应先用小任务补证据。</p>}
      </section>

      <section className="deep-report-block career-hypotheses">
        <h3>当前值得优先验证的职业方向</h3>
        <p className="job-research-note">这些是可搜索、可验证的职业假设，不是唯一答案或录用保证。</p>
        <div className="career-hypothesis-list">
          {report.careerHypotheses.map((hypothesis) => (
            <article className="career-hypothesis-card" data-testid="career-hypothesis" key={hypothesis.title}>
              <p className="career-tier">{hypothesis.tier}</p>
              <h4>{hypothesis.title}</h4>
              <dl>
                <dt>为什么进入候选</dt><dd>{hypothesis.whyConsidered}</dd>
                <dt>现实匹配</dt><dd>{hypothesis.realityFit}</dd>
                <dt>最大门槛</dt><dd>{hypothesis.largestBarrier}</dd>
                <dt>可迁移资产</dt><dd>{hypothesis.transferableAssets.length ? hypothesis.transferableAssets.join('、') : '尚未确认'}</dd>
                <dt>主要风险</dt><dd>{hypothesis.mainRisk}</dd>
                <dt>最低成本验证</dt><dd>{hypothesis.minimumCostExperiment}</dd>
              </dl>
              <div className={`career-evidence-status evidence-${hypothesis.evidenceStatus}`}>
                <strong>{evidenceLabels[hypothesis.evidenceStatus]}{hypothesis.sourceCount ? ` · ${hypothesis.sourceCount} 条` : ''}</strong>
                <p>{hypothesis.marketEvidenceSummary}</p>
                {hypothesis.sources.length ? <ul>{hypothesis.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} · {source.site}<span aria-hidden="true">↗</span></a>
                    <p>{source.excerpt}</p>
                  </li>
                ))}</ul> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {report.deprioritizedDirections.length ? (
        <section className="deep-report-block career-deprioritized">
          <h3>当前不宜优先验证的方向</h3>
          {report.deprioritizedDirections.map((direction) => (
            <article key={direction.title}>
              <h4>{direction.title}</h4>
              <ul>{direction.constraintReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            </article>
          ))}
        </section>
      ) : null}

      <section className="deep-report-block career-thirty-day-plan">
        <h3>未来 30 天验证计划</h3>
        <ol>{report.thirtyDayPlan.map((action) => (
          <li key={`${action.timeframe}-${action.title}`}>
            <span>{action.timeframe}</span>
            <strong>{action.title}</strong>
            <p>{action.detail}</p>
          </li>
        ))}</ol>
      </section>

      <footer className="deep-disclaimer">{report.disclaimer}</footer>
    </article>
  );
}
