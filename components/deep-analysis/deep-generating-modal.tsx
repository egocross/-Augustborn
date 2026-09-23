const stageCopy: Record<string, { title: string; note: string }> = {
  preparing: { title: '正在整理你的信息', note: '核对基础报告与现实校准答案…' },
  analyzing: { title: '正在分析关键取舍', note: '寻找优势、约束与机会之间的关系…' },
  structuring: { title: '正在组织专项建议', note: '把分析转化为清晰、可行动的方向…' },
  validating: { title: '正在完成最后检查', note: '确保报告结构完整且表达客观…' },
};

export function DeepGeneratingModal({ stage = 'preparing', onCancel }: { stage?: string; onCancel?: () => void }) {
  const copy = stageCopy[stage] ?? stageCopy.preparing;
  return <div className="deep-generating-overlay"><div aria-label="正在生成深度报告" aria-modal="true" className="generating-modal deep-generating-modal" role="dialog"><span aria-hidden="true" className="generating-orb" /><p aria-live="polite" className="generating-stage">{copy.title}</p><div aria-hidden="true" className="progress-track"><span className="progress-bar" /></div><p className="generating-note">{copy.note}</p>{onCancel ? <button className="generating-cancel" onClick={onCancel} type="button">取消生成</button> : null}</div></div>;
}
