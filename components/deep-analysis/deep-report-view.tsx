'use client';

import { useId, useState } from 'react';
import { LegacyDeepReportSchema, type DeepReport, type LegacyDeepReport } from '@/lib/deep-analysis/types';
import { JobRecommendations } from './job-recommendations';
import { ExplorationSections } from './exploration-sections';
import { CareerReportView } from './career-report-view';

const priorityLabels: Record<'primary' | 'secondary' | 'watch', string> = {
  primary: '第一优先方向',
  secondary: '第二优先方向',
  watch: '观察方向',
};

function DirectionRanking({ report }: { report: LegacyDeepReport }) {
  if (!report.directionRanking?.length) return null;
  return <section className="deep-report-block direction-ranking">
    <h3>这次筛选后的最终排序</h3>
    <p className="job-research-note">排序综合了初始报告的假设和你在校准问题里的现实约束。第一优先方向优先验证，其余方向先观察。</p>
    <div className="ranking-list">{report.directionRanking.map((item, index) => <section className={`ranking-card ranking-${item.priority}`} key={`${index}-${item.title}`}>
      <p className="ranking-badge">{priorityLabels[item.priority]}</p>
      <h4>{item.title}</h4>
      <p>{item.whyKept}</p>
      <dl className="ranking-detail">
        <dt>更适合承担</dt><dd><ul>{item.roleFit.map((role) => <li key={role}>{role}</li>)}</ul></dd>
        <dt>最匹配的工作</dt><dd><ul>{item.taskFit.map((task) => <li key={task}>{task}</li>)}</ul></dd>
        <dt>不优先承担</dt><dd><ul className="ranking-not-fit">{item.notFit.map((task) => <li key={task}>{task}</li>)}</ul></dd>
      </dl>
    </section>)}</div>
  </section>;
}

function ExcludedDirections({ report }: { report: LegacyDeepReport }) {
  if (!report.excludedDirections?.length) return null;
  return <section className="deep-report-block excluded-directions">
    <h3>这次被降低或排除的方向</h3>
    <p className="job-research-note">这些方向不是“不好”，而是与你本次的现实约束不匹配，先不投入主要精力。</p>
    <div className="excluded-list">{report.excludedDirections.map((item, index) => <div className="excluded-row" key={`${index}-${item.title}`}>
      <strong>{item.title}</strong>
      <p>{item.reason}</p>
    </div>)}</div>
  </section>;
}

function Calibration({ report }: { report: LegacyDeepReport }) {
  if (!report.calibration) return null;
  return <section className="deep-report-block calibration-panel">
    <h3>本次校准发生了什么</h3>
    <ul className="calibration-list">{report.calibration.constraints.map((item) => <li key={item}>{item}</li>)}</ul>
    <p className="calibration-narrowing">{report.calibration.narrowing}</p>
  </section>;
}

function WorkSplit({ report }: { report: LegacyDeepReport }) {
  if (!report.workSplit) return null;
  return <section className="deep-report-block work-split">
    <h3>最适合你的工作组合</h3>
    <div className="work-split-grid">
      <div><h4>你负责</h4><ul>{report.workSplit.youOwn.map((item) => <li key={item}>{item}</li>)}</ul></div>
      {report.workSplit.partnerOwns.length > 0 ? <div><h4>合作者负责</h4><ul>{report.workSplit.partnerOwns.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
    </div>
    {report.workSplit.note ? <p className="job-research-note">{report.workSplit.note}</p> : null}
  </section>;
}

function ValidationPlan({ report }: { report: LegacyDeepReport }) {
  if (!report.validationPlan) return null;
  const plan = report.validationPlan;
  return <section className="deep-report-block validation-plan">
    <h3>未来 30 天唯一验证任务</h3>
    <p className="validation-task">{plan.task}</p>
    <ol className="validation-weeks">{plan.weeks.map((week) => <li key={week.label}><span>{week.label}</span><p>{week.detail}</p></li>)}</ol>
    {plan.successCriteria.length ? <div className="success-criteria"><h4>通过标准</h4><ul>{plan.successCriteria.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
    {plan.fallbackNote ? <p className="job-research-note">{plan.fallbackNote}</p> : null}
  </section>;
}

function LegacyDeepReportView({ report }: { report: LegacyDeepReport }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const baseId = useId();
  const detailsId = (id: string) => `${baseId}-${id}`;
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const nextAction = report.nextAction ?? report.nextActions[0];

  return <article className="deep-report-view">
    <header className="deep-report-hero">
      <p className="eyebrow">专项探索报告</p>
      <h2>{report.title}</h2>
      <p>{report.summary}</p>
    </header>

    <section className="finding-panel">
      <h3 className="finding-title">先看结论</h3>
      <ul className="finding-list">{report.keyFindings.map((finding) => <li key={finding}>{finding}</li>)}</ul>
    </section>

    <Calibration report={report} />

    <DirectionRanking report={report} />

    <ExcludedDirections report={report} />

    <WorkSplit report={report} />

    {report.workDirections && !report.directionRanking ? <section className="deep-report-block work-directions">
      <h3>可以进一步探索的工作方向</h3>
      <p className="job-research-note">这些标签帮助你扩展搜索，不代表已核实的在招岗位；可结合实际职责与门槛继续筛选。</p>
      <div className="work-direction-groups">{report.workDirections.groups.map((group, index) => <section className="work-direction-group" key={`${index}-${group.title}`}>
        <h4>{group.title}</h4>
        <ul className="work-direction-tags" aria-label={`${group.title}的搜索标签`}>{group.tags.map((tag, tagIndex) => <li key={`${tagIndex}-${tag}`}>{tag}</li>)}</ul>
        <p>{group.rationale}</p>
        <p className="work-direction-boundary"><strong>先核对：</strong>{group.boundary}</p>
      </section>)}</div>
      <div className="work-direction-intersection"><h4>这些方向的交集在哪里？</h4><p>{report.workDirections.intersection}</p></div>
    </section> : null}

    <ExplorationSections report={report} />

    <div className="deep-card-list">{report.cards.map((card, index) => {
      const open = expanded.has(card.id);
      return <section className="deep-report-card" key={card.id}>
        <p aria-hidden="true" className="deep-card-index">{String(index + 1).padStart(2, '0')}</p>
        <h3>{card.title}</h3>
        <p>{card.summary}</p>
        <button aria-controls={detailsId(card.id)} aria-expanded={open} className="disclosure-button" onClick={() => toggle(card.id)} type="button">{open ? '收起详情' : '展开阅读'}<span aria-hidden="true">{open ? '−' : '+'}</span></button>
        {open ? <div className="card-details" id={detailsId(card.id)}><ul>{card.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>{card.evidence.length ? <><h4>判断依据</h4><ul>{card.evidence.map((item) => <li key={item}>{item}</li>)}</ul></> : null}</div> : null}
      </section>;
    })}</div>

    {report.jobResearch ? <JobRecommendations research={report.jobResearch} /> : null}

    <section className="deep-report-block deep-report-block-warning">
      <h3>需要特别注意</h3>
      {report.risks.map((risk) => <div className="risk-row" key={risk.title}>
        <strong>{risk.title}</strong>
        <p>{risk.detail}</p>
        {risk.signal ? <p><b>预警信号：</b>{risk.signal}</p> : null}
        <p><b>应对：</b>{risk.mitigation}</p>
      </div>)}
    </section>

    <ValidationPlan report={report} />

    {nextAction ? <section className="deep-report-block next-action-panel">
      <h3>当前唯一优先行动</h3>
      <div className="next-action-card">
        <span className="next-action-timeframe">{nextAction.timeframe}</span>
        <strong>{nextAction.title}</strong>
        <p>{nextAction.detail}</p>
      </div>
    </section> : null}

    {report.nextActions.length > 1 ? <section className="deep-report-block">
      <h3>辅助行动</h3>
      <ol>{report.nextActions.slice(1).map((action) => <li key={action.title}><span>{action.timeframe}</span><strong>{action.title}</strong><p>{action.detail}</p></li>)}</ol>
    </section> : null}

    {report.reflectionQuestions.length ? <section className="deep-report-block"><h3>建议你继续思考</h3><ul>{report.reflectionQuestions.map((question) => <li key={question}>{question}</li>)}</ul></section> : null}

    <footer className="deep-disclaimer">{report.disclaimer}</footer>
  </article>;
}

export function DeepReportView({ report }: { report: DeepReport }) {
  if ('kind' in report && report.kind === 'career-calibration') {
    return <CareerReportView report={report} />;
  }

  return <LegacyDeepReportView report={LegacyDeepReportSchema.parse(report)} />;
}
