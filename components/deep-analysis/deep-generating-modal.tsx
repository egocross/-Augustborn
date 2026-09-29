'use client';

import { createPortal } from 'react-dom';
import { useDocumentScrollLock } from '@/lib/use-document-scroll-lock';

const stageCopy: Record<string, { title: string; note: string }> = {
  preparing: { title: '正在整理基础职业倾向', note: '只读继承基础报告，不改变原有判断…' },
  constraints: { title: '正在识别现实限制', note: '先用收入、地点、时间与责任筛除不可行方向…' },
  capital: { title: '正在评估可迁移职业资本', note: '核对可以带到下一份职业的经验、技能与成果…' },
  market_research: { title: '正在检索中国招聘市场', note: '优先核对当前公开岗位、职责与可验证来源…' },
  candidate_analysis: { title: '正在收窄候选职业方向', note: '综合基础倾向、现实边界、职业资本与市场证据…' },
  work_reality: { title: '正在核对岗位真实工作', note: '逐个确认核心任务、交付物、协作与容易忽略的部分…' },
  capability_signals: { title: '正在分析入场能力信号', note: '区分已经具备、可以快速补齐和短期无法补齐的门槛…' },
  validation_paths: { title: '正在生成最低成本验证路径', note: '按岗位特点选择信息增益更高、成本更低的真实行动…' },
  validating: { title: '正在检查报告完整性', note: '核对事实来源与结构，单个职业失败不会影响其他结果…' },
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
