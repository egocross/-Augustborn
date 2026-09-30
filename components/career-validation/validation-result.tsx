'use client';

import type { ValidationNextAction, ValidationResult } from '@/lib/career-validation/schema';

const statusLabels: Record<ValidationResult['status'], string> = {
  worth_continuing: '值得继续验证',
  insufficient_evidence: '证据还不足',
  do_not_increase_investment: '先不要加大投入',
};

const dimensionLabels: Record<ValidationResult['evidence'][number]['dimension'], string> = {
  task_performance: '任务表现',
  work_experience_feeling: '工作体验',
  learning_response: '学习反应',
  real_world_feasibility: '现实可行性',
  external_feedback: '外部反馈',
};

const signalLabels: Record<ValidationResult['evidence'][number]['signal'], string> = {
  support: '支持',
  mixed: '混合',
  no_evidence: '无证据',
  risk: '风险信号',
};

type ValidationResultProps = {
  result: ValidationResult;
  onStartNext: () => void;
  nextBusy?: boolean;
};

export function ValidationResultView({ result, onStartNext, nextBusy = false }: ValidationResultProps) {
  const action: ValidationNextAction = result.nextAction;
  const canStartNext = action.type === 'in_product_experiment' && action.canStartInProduct;

  return <section className="validation-result" data-testid="validation-result">
    <header className="validation-result-hero">
      <p className="eyebrow">验证结果</p>
      <h1>{result.validatedQuestion}</h1>
      <p className={`validation-verdict verdict-${result.status}`}>{statusLabels[result.status]}</p>
    </header>

    <section className="validation-result-block">
      <h2>证据逐条看</h2>
      <ul className="validation-evidence-list">{result.evidence.map((item) => (
        <li className={`validation-evidence evidence-${item.signal}`} key={`${item.dimension}-${item.observation}`}>
          <p className="validation-evidence-head"><span>{dimensionLabels[item.dimension]}</span><strong>{signalLabels[item.signal]}</strong></p>
          <p><b>观察：</b>{item.observation}</p>
          <p><b>解释：</b>{item.interpretation}</p>
          <p className="validation-evidence-limit"><b>边界：</b>{item.limitation}</p>
        </li>
      ))}</ul>
    </section>

    <section className="validation-result-block validation-result-split">
      <div><h2>支持继续的证据</h2><ul>{result.supportingEvidence.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div><h2>风险信号</h2><ul>{result.riskSignals.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div><h2>还不知道的</h2><ul>{result.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></div>
    </section>

    <section className="validation-result-block">
      <h2>为什么这样判断</h2>
      <p>{result.reasoning}</p>
    </section>

    <section className="validation-next-action">
      <p className="eyebrow">接下来的唯一一步</p>
      <h2>{action.title}</h2>
      <p>{action.detail}</p>
      <p className="validation-next-meta">{action.estimatedTimeLabel ?? (action.estimatedMinutes ? `预计 ${action.estimatedMinutes} 分钟` : null)}{action.estimatedTimeLabel || action.estimatedMinutes ? ' · ' : ''}成本：{action.cost}</p>
      {canStartNext
        ? <button className="primary-button" disabled={nextBusy} onClick={onStartNext} type="button">{nextBusy ? '正在准备…' : '开始下一轮验证'}</button>
        : <p className="validation-external-note">这一步在站外完成，产品不会自动跟踪进度。</p>}
    </section>
  </section>;
}
