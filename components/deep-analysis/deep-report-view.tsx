'use client';

import { useState } from 'react';
import type { DeepReport } from '@/lib/deep-analysis/types';

export function DeepReportView({ report }: { report: DeepReport }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  return <article className="deep-report-view">
    <header className="deep-report-hero"><p className="eyebrow">专项探索报告</p><h2>{report.title}</h2><p>{report.summary}</p></header>
    <section className="finding-panel"><h3>先看结论</h3><ul>{report.keyFindings.map((finding) => <li key={finding}>{finding}</li>)}</ul></section>
    <div className="deep-card-list">{report.cards.map((card) => {
      const open = expanded.has(card.id);
      return <section className="deep-report-card" key={card.id}><h3>{card.title}</h3><p>{card.summary}</p><button aria-expanded={open} className="disclosure-button" onClick={() => toggle(card.id)} type="button">{open ? '收起详情' : '展开阅读'}<span aria-hidden="true">{open ? '−' : '+'}</span></button>{open ? <div className="card-details"><ul>{card.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>{card.evidence.length ? <><h4>判断依据</h4><ul>{card.evidence.map((item) => <li key={item}>{item}</li>)}</ul></> : null}</div> : null}</section>;
    })}</div>
    <section className="deep-report-block"><h3>需要特别注意</h3>{report.risks.map((risk) => <div className="risk-row" key={risk.title}><strong>{risk.title}</strong><p>{risk.detail}</p><p><b>应对：</b>{risk.mitigation}</p></div>)}</section>
    <section className="deep-report-block"><h3>接下来可以怎么做</h3><ol>{report.nextActions.map((action) => <li key={action.title}><span>{action.timeframe}</span><strong>{action.title}</strong><p>{action.detail}</p></li>)}</ol></section>
    {report.reflectionQuestions.length ? <section className="deep-report-block"><h3>建议你继续思考</h3><ul>{report.reflectionQuestions.map((question) => <li key={question}>{question}</li>)}</ul></section> : null}
    <footer className="deep-disclaimer">{report.disclaimer}</footer>
  </article>;
}
