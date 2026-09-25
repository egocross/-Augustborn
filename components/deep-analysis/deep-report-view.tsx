'use client';

import { useId, useState } from 'react';
import type { DeepReport } from '@/lib/deep-analysis/types';
import { JobRecommendations } from './job-recommendations';
import { ExplorationSections } from './exploration-sections';

export function DeepReportView({ report }: { report: DeepReport }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const baseId = useId();
  const detailsId = (id: string) => `${baseId}-${id}`;
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

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

    <section className="deep-report-block deep-report-block-warning">
      <h3>需要特别注意</h3>
      {report.risks.map((risk) => <div className="risk-row" key={risk.title}><strong>{risk.title}</strong><p>{risk.detail}</p><p><b>应对：</b>{risk.mitigation}</p></div>)}
    </section>

    <section className="deep-report-block">
      <h3>接下来可以怎么做</h3>
      <ol>{report.nextActions.map((action) => <li key={action.title}><span>{action.timeframe}</span><strong>{action.title}</strong><p>{action.detail}</p></li>)}</ol>
    </section>

    {report.workDirections ? <section className="deep-report-block work-directions">
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

    {report.jobResearch ? <JobRecommendations research={report.jobResearch} /> : null}

    {report.reflectionQuestions.length ? <section className="deep-report-block"><h3>建议你继续思考</h3><ul>{report.reflectionQuestions.map((question) => <li key={question}>{question}</li>)}</ul></section> : null}

    <footer className="deep-disclaimer">{report.disclaimer}</footer>
  </article>;
}
