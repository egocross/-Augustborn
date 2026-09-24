import type { DeepReport } from '@/lib/deep-analysis/types';
import type { MarketResearch } from '@/lib/deep-analysis/research/market-schema';

function DirectionGroups({ value }: { value: NonNullable<DeepReport['industryDirections']> }) {
  return <>
    <div className="work-direction-groups">{value.groups.map((group, index) => <section className="work-direction-group" key={`${index}-${group.title}`}>
      <h4>{group.title}</h4>
      <ul className="work-direction-tags" aria-label={`${group.title}的探索标签`}>{group.tags.map((tag, i) => <li key={`${i}-${tag}`}>{tag}</li>)}</ul>
      <p>{group.rationale}</p><p className="work-direction-boundary"><strong>先核对：</strong>{group.boundary}</p>
    </section>)}</div>
    <div className="work-direction-intersection"><h4>这些方向的交集在哪里？</h4><p>{value.intersection}</p></div>
  </>;
}

function SourceExamples({ examples }: { examples: MarketResearch['examples'] }) {
  return <div className="job-recommendation-list">{examples.map((example) => <article className="job-recommendation-card" key={example.name}>
    <h4>{example.name}</h4><p>{example.fitReason}</p>
    <details className="job-recommendation-details"><summary>查看取舍、资料与下一步</summary>
      <dl><dt>需要核对</dt><dd>{example.boundary}</dd><dt>先做一个小验证</dt><dd>{example.nextStep}</dd></dl>
      {example.sources.map((source) => <div className="market-source" key={source.url}>
        <p className="job-research-note">检索摘要：{source.excerpt}</p>
        <a className="job-source-link" href={source.url} target="_blank" rel="noopener noreferrer">{source.title} · {source.site}<span aria-hidden="true">↗</span></a>
      </div>)}
    </details>
  </article>)}</div>;
}

function ResearchNote({ research }: { research?: MarketResearch }) {
  if (!research) return <p className="job-research-note">尚无本次检索资料，具体实例待核对。</p>;
  return <div className="market-research-note">
    {research.status !== 'sample' ? <p className="job-checked-at">资料检索时间 <time dateTime={research.checkedAt}>{new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai' }).format(new Date(research.checkedAt))}</time></p> : null}
    <p className="job-research-note" role={research.status === 'unavailable' ? 'status' : undefined}>{research.note}</p>
  </div>;
}

function SearchSuggestions({ html }: { html?: string }) {
  if (!html) return null;
  const document = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
  return <iframe className="job-search-suggestions" title="Google 搜索建议" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={document} />;
}

const tierTitles: Record<number, string> = { 1: '第一梯队 · 优先探索', 2: '第二梯队 · 条件匹配后考虑', 3: '第三梯队 · 暂作备选' };

export function ExplorationSections({ report }: { report: DeepReport }) {
  return <>
    {report.industryDirections ? <section className="deep-report-block work-directions industry-directions">
      <h3>先拓宽你的行业选择</h3><p className="job-research-note">先看能发挥优势的细分方向，再用产业资料和实际机会核对。探索标签不代表行业景气或保证适合。</p>
      <DirectionGroups value={report.industryDirections} />
      <div className="market-examples"><h3>结合公开资料，看几个具体方向</h3>
        <ResearchNote research={report.marketResearch} /><SourceExamples examples={report.marketResearch?.examples ?? []} />
      </div>
      <SearchSuggestions html={report.marketResearch?.searchSuggestionsHtml} />
    </section> : null}
    {report.cityPlan ? <section className="deep-report-block work-directions city-directions">
      <h3>按你的条件，分三步看城市</h3><p className="job-research-note">梯队表示你的探索优先级，不是城市实力或一二三线排名。没有足够证据时，不为凑数推荐城市。</p>
      <ResearchNote research={report.marketResearch} />
      <div className="work-direction-groups">{[...report.cityPlan.tiers].sort((a, b) => a.priority - b.priority).map((tier) => {
        const examples = report.marketResearch?.examples.filter((example) => example.priority === tier.priority) ?? [];
        return <section className="city-tier work-direction-group" key={tier.priority}>
          <h4>{tierTitles[tier.priority]}</h4><p className="city-tier-profile">{tier.profile}</p><p>{tier.rationale}</p>
          <p className="work-direction-boundary"><strong>进入这一梯队的条件：</strong>{tier.boundary}</p>
          {examples.length ? <SourceExamples examples={examples} /> : <p className="job-research-note">本梯队暂不列具体城市，按上述条件进一步核对。</p>}
        </section>;
      })}</div>
      <div className="work-direction-intersection"><h4>先验证条件，再决定城市</h4><p>{report.cityPlan.intersection}</p></div>
      <SearchSuggestions html={report.marketResearch?.searchSuggestionsHtml} />
    </section> : null}
    {report.collaborationPlan ? <section className="deep-report-block work-directions collaboration-directions">
      <h3>哪些能力能与你形成互补？</h3><p className="job-research-note">看实际行为与任务分工，不给人贴固定性格标签。能力互补，也需要共同目标和相互尊重。</p>
      <DirectionGroups value={report.collaborationPlan} />
      <div className="market-examples"><h3>把互补变成具体分工</h3><div className="work-direction-groups">
        {report.collaborationPlan.scenarios.map((scenario, index) => <section className="work-direction-group collaboration-scenario" key={`${index}-${scenario.title}`}>
          <h4>{scenario.title}</h4><dl>
            <dt>你负责</dt><dd>{scenario.yourRole}</dd><dt>对方负责</dt><dd>{scenario.partnerRole}</dd>
            <dt>共同决定</dt><dd>{scenario.sharedDecision}</dd><dt>先试一次合作</dt><dd>{scenario.trial}</dd>
          </dl><details className="job-recommendation-details"><summary>留意这些合作信号</summary><ul>{scenario.redFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul></details>
        </section>)}
      </div></div>
    </section> : null}
  </>;
}
