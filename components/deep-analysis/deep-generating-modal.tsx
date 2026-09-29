'use client';

import { createPortal } from 'react-dom';
import { useDocumentScrollLock } from '@/lib/use-document-scroll-lock';

const stageCopy: Record<string, { title: string; note: string }> = {
  preparing: { title: '正在整理基础职业倾向', note: '只读继承基础报告，不改变原有判断…' },
  constraints: { title: '正在识别现实限制', note: '先用收入、地点、时间与责任筛除不可行方向…' },
  capital: { title: '正在评估可迁移职业资本', note: '核对可以带到下一份职业的经验、技能与成果…' },
  researching: { title: '正在核对职业市场证据', note: '检索招聘实例，核对职位名称、职责与来源…' },
  converging: { title: '正在收窄候选职业方向', note: '综合基础倾向、现实边界、职业资本与市场证据…' },
  validating: { title: '正在生成低成本验证路径', note: '把候选方向转化为未来 30 天可以执行的动作…' },
};

export function DeepGeneratingModal({ stage = 'preparing', onCancel }: { stage?: string; onCancel?: () => void }) {
  const copy = stageCopy[stage] ?? stageCopy.preparing;
  useDocumentScrollLock(true);

  return createPortal(
    <div className="deep-generating-overlay">
      <div aria-label="正在生成深度报告" aria-modal="true" className="generating-modal deep-generating-modal" role="dialog">
        <span aria-hidden="true" className="generating-orb" />
        <p aria-live="polite" className="generating-stage">{copy.title}</p>
        <div aria-hidden="true" className="progress-track"><span className="progress-bar" /></div>
        <p className="generating-note">{copy.note}</p>
        {onCancel ? <button className="generating-cancel" onClick={onCancel} type="button">取消生成</button> : null}
      </div>
    </div>,
    document.body,
  );
}
