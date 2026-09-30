import type { CareerReport, CareerWorkValidation } from '@/lib/deep-analysis/types';
import type { ValidationAccess } from '@/lib/deep-analysis/stream';

type Hypothesis = CareerReport['careerHypotheses'][number];

const evidenceLabels: Record<Hypothesis['evidenceStatus'], string> = {
  verified: '多条来源支持',
  partial: '部分来源支持',
  unavailable: '市场可行性待验证',
};

const signalTypeLabels: Record<CareerWorkValidation['capabilitySignals']['hiringSignalType'], string> = {
  portfolio_project: '作品 / 项目型',
  business_result: '业务结果型',
  experience_based: '经验依赖型',
  credential_required: '资质准入型',
  hands_on_skill: '技能实操型',
  senior_experience: '高经验 / 高责任型',
  mixed: '混合证明机制',
};

function CandidateSources({ hypothesis }: { hypothesis: Hypothesis }) {
  return <div className={`career-evidence-status evidence-${hypothesis.evidenceStatus}`}>
    <strong>{evidenceLabels[hypothesis.evidenceStatus]}{hypothesis.sourceCount ? ` · ${hypothesis.sourceCount} 条` : ''}</strong>
    <p>{hypothesis.marketEvidenceSummary}</p>
    {hypothesis.sources.length ? <ul>{hypothesis.sources.map((source) => (
      <li key={source.url}>
        <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} · {source.site}<span aria-hidden="true">↗</span></a>
        <p>{source.excerpt}</p>
      </li>
    ))}</ul> : null}
  </div>;
}

function ValidationActionCard({ action, index }: {
  action: CareerWorkValidation['validationPath'][number];
  index: number;
}) {
  return <article className="career-validation-action">
    <p className="career-action-index">行动 {String(index + 1).padStart(2, '0')}</p>
    <h6>{action.title}</h6>
    <dl>
      <dt>验证什么</dt><dd>{action.validates}</dd>
      <dt>怎么做</dt><dd><ol>{action.steps.map((step) => <li key={step}>{step}</li>)}</ol></dd>
      <dt>时间 / 成本</dt><dd>{action.estimatedTime} · {action.estimatedCost}</dd>
      <dt>最终得到什么</dt><dd>{action.deliverable}</dd>
      <dt>做完怎么看</dt><dd><ul>{action.successSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul></dd>
      {action.stopSignals?.length ? <><dt>暂停信号</dt><dd><ul>{action.stopSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul></dd></> : null}
    </dl>
  </article>;
}

function FullValidation({ validation }: { validation: CareerWorkValidation }) {
  const signals = validation.capabilitySignals;
  return <div className="career-validation-full">
    <section className="career-validation-section">
      <p className="career-validation-number">01</p>
      <div>
        <h5>这个工作真实是什么样</h5>
        <dl className="career-validation-grid">
          <dt>日常核心工作</dt><dd><ul>{validation.workReality.coreTasks.map((item) => <li key={item}>{item}</li>)}</ul></dd>
          <dt>典型交付物</dt><dd><ul>{validation.workReality.deliverables.map((item) => <li key={item}>{item}</li>)}</ul></dd>
          <dt>常见考核方式</dt><dd><ul>{validation.workReality.performanceSignals.map((item) => <li key={item}>{item}</li>)}</ul></dd>
          <dt>高频协作对象</dt><dd>{validation.workReality.collaborationWith.join('、')}</dd>
          <dt>容易忽略的部分</dt><dd><ul>{validation.workReality.overlookedReality.map((item) => <li key={item}>{item}</li>)}</ul></dd>
        </dl>
        {validation.workReality.variabilityNotes?.length ? <p className="career-variability-note">{validation.workReality.variabilityNotes.join('；')}</p> : null}
      </div>
    </section>

    <section className="career-validation-section">
      <p className="career-validation-number">02</p>
      <div>
        <h5>你目前的入场能力信号</h5>
        <p className="career-signal-type">招聘证明机制：{signalTypeLabels[signals.hiringSignalType]}</p>
        {signals.existingSignals.length ? <div className="career-signal-group"><h6>已有信号</h6><ul>{signals.existingSignals.map((item) => <li key={`${item.signal}-${item.evidence}`}><strong>{item.signal}</strong><span>{item.evidence}</span>{item.boundary ? <small>{item.boundary}</small> : null}</li>)}</ul></div> : <p className="career-empty-note">目前没有确认足够直接的入场信号。</p>}
        <div className="career-signal-group career-gap-group"><h6>关键缺口</h6><ul>{signals.criticalGaps.map((item) => <li key={item.gap}><strong>{item.gap}</strong><span>{item.impact}</span></li>)}</ul></div>
        {signals.hardBarriers.length ? <div className="career-signal-group career-hard-barriers"><h6>短期无法补齐的门槛</h6><ul>{signals.hardBarriers.map((item) => <li key={item.barrier}><strong>{item.barrier}</strong><span>{item.explanation}</span><small>{item.evidenceStatus === 'verified' ? '有公开证据支持' : '仍需官方或招聘信息核实'}</small></li>)}</ul></div> : null}
        {signals.bridgePaths.length ? <div className="career-signal-group"><h6>替代进入路径</h6>{signals.bridgePaths.map((path) => <div className="career-bridge-path" key={`${path.from}-${path.to}`}><p><strong>{path.from}</strong><span aria-hidden="true">→</span><strong>{path.to}</strong></p><ol>{path.steps.map((step) => <li key={step}>{step}</li>)}</ol><small>{path.why}</small></div>)}</div> : null}
      </div>
    </section>

    <section className="career-validation-section">
      <p className="career-validation-number">03</p>
      <div>
        <h5>最值得补的能力证据</h5>
        {signals.fastBuildableSignals.length ? <div className="career-fast-signals">{signals.fastBuildableSignals.map((item) => <article key={item.title}><h6>{item.title}</h6><p>{item.rationale}</p><p><strong>产出：</strong>{item.deliverable}</p><small>{item.estimatedTime}</small></article>)}</div> : <p className="career-empty-note">当前不适合为了“看起来准备充分”而补造作品；先核实真实门槛。</p>}
      </div>
    </section>

    <section className="career-validation-section">
      <p className="career-validation-number">04</p>
      <div>
        <h5>最低成本职业验证路径</h5>
        <div className="career-validation-actions">{validation.validationPath.map((action, index) => <ValidationActionCard action={action} index={index} key={`${action.level}-${action.title}`} />)}</div>
      </div>
    </section>

    <details className="career-market-evidence">
      <summary>查看市场证据与边界</summary>
      <p>{validation.note}</p>
      {validation.workReality.evidence.length ? <ul>{validation.workReality.evidence.map((evidence) => <li key={`${evidence.url ?? evidence.title}-${evidence.fact}`}><strong>{evidence.title}</strong><p>{evidence.fact}</p>{evidence.url ? <a href={evidence.url} target="_blank" rel="noopener noreferrer">查看来源<span aria-hidden="true">↗</span></a> : null}</li>)}</ul> : <p>当前公开信息不足，没有把模型推断包装成市场事实。</p>}
    </details>
  </div>;
}

function CareerHypothesisCard({ hypothesis, access }: { hypothesis: Hypothesis; access?: ValidationAccess }) {
  const validation = hypothesis.workValidation;
  if (!validation) return <article className="career-hypothesis-card" data-testid="career-hypothesis">
    <p className="career-tier">{hypothesis.tier}</p>
    <h4>{hypothesis.title}</h4>
    <dl>
      <dt>为什么进入候选</dt><dd>{hypothesis.whyConsidered}</dd>
      <dt>现实匹配</dt><dd>{hypothesis.realityFit}</dd>
      <dt>最大门槛</dt><dd>{hypothesis.largestBarrier}</dd>
      <dt>最低成本验证</dt><dd>{hypothesis.minimumCostExperiment}</dd>
    </dl>
    <CandidateSources hypothesis={hypothesis} />
  </article>;

  const firstGap = validation.capabilitySignals.criticalGaps[0];
  const firstAction = validation.validationPath[0];
  return <article className={`career-hypothesis-card career-validation-card validation-${validation.status}`} data-testid="career-hypothesis">
    <div className="career-card-heading">
      <div><p className="career-tier">{hypothesis.tier}</p><h4>{hypothesis.title}</h4></div>
      <span className={`career-validation-status status-${validation.status}`}>{validation.status === 'complete' ? '岗位已核实' : validation.status === 'partial' ? '部分信息待核实' : '公开信息不足'}</span>
    </div>
    <p className="career-candidate-reason">{hypothesis.whyConsidered}</p>
    <div className="career-decision-summary">
      <section><p>真实核心工作</p><strong>{validation.workReality.coreTasks[0]}</strong></section>
      <section className="career-decision-gap"><p>最大入场缺口</p><strong>{firstGap.gap}</strong><span>{firstGap.impact}</span></section>
      <section className="career-decision-action"><p>先做这个验证</p><strong>{firstAction.title}</strong><span>{firstAction.estimatedTime} · {firstAction.estimatedCost}</span><small>产出：{firstAction.deliverable}</small></section>
    </div>
    <CandidateSources hypothesis={hypothesis} />
    {access ? <a className="primary-button career-validator-cta" href={`/career-validation/${access.validationSessionId}`}>
      开始真实任务验证<span aria-hidden="true">→</span>
    </a> : null}
    <details className="career-validation-disclosure">
      <summary>查看完整工作验证<span aria-hidden="true">＋</span></summary>
      <FullValidation validation={validation} />
    </details>
  </article>;
}

export function CareerReportView({ report, validationAccess = [] }: { report: CareerReport; validationAccess?: ValidationAccess[] }) {
  const hasWorkValidation = report.careerHypotheses.some((hypothesis) => Boolean(hypothesis.workValidation));
  let eligibleIndex = 0;
  const hypothesisViews = report.careerHypotheses.map((hypothesis) => ({
    hypothesis,
    access: hypothesis.workValidation ? validationAccess[eligibleIndex++] : undefined,
  }));
  return (
    <article className="deep-report-view career-report-view">
      <header className="deep-report-hero">
        <p className="eyebrow">职业专项报告</p>
        <h2>{report.title}</h2>
        <p>{report.summary}</p>
      </header>

      <section className="deep-report-block career-hypotheses">
        <h3>当前值得优先验证的职业方向</h3>
        <p className="job-research-note">这些是可搜索、可验证的职业假设。验证结果也可能推翻候选方向，而不是证明它一定适合你。</p>
        <div className="career-hypothesis-list">{hypothesisViews.map(({ hypothesis, access }, index) => <CareerHypothesisCard access={access} hypothesis={hypothesis} key={`${index}-${hypothesis.title}`} />)}</div>
      </section>

      <section className="deep-report-block career-boundaries">
        <h3>你的现实职业边界</h3>
        <ul>{report.realityBoundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}</ul>
      </section>

      <section className="deep-report-block career-capital-report">
        <h3>你的可迁移职业资本</h3>
        {report.transferableCapital.length ? <dl>{report.transferableCapital.map((item) => <div key={`${item.asset}-${item.application}`}><dt>{item.asset}</dt><dd>{item.application}</dd></div>)}</dl> : <p>目前没有确认足够明确的可迁移职业资本；进入新方向时应先用小任务补证据。</p>}
      </section>

      {report.deprioritizedDirections.length ? <section className="deep-report-block career-deprioritized"><h3>当前不宜优先验证的方向</h3>{report.deprioritizedDirections.map((direction) => <article key={direction.title}><h4>{direction.title}</h4><ul>{direction.constraintReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></article>)}</section> : null}

      {!hasWorkValidation ? <section className="deep-report-block career-thirty-day-plan"><h3>未来 30 天验证计划</h3><ol>{report.thirtyDayPlan.map((action) => <li key={`${action.timeframe}-${action.title}`}><span>{action.timeframe}</span><strong>{action.title}</strong><p>{action.detail}</p></li>)}</ol></section> : null}

      <footer className="deep-disclaimer">{report.disclaimer}</footer>
    </article>
  );
}
