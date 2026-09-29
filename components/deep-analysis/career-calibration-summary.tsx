import type { CareerCalibration } from '@/lib/deep-analysis/career-calibration';
import { summarizeCareerCalibration } from '@/lib/deep-analysis/career-calibration';

export function CareerCalibrationSummary({
  calibration,
  onConfirm,
  onEdit,
}: {
  calibration: CareerCalibration;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  return (
    <section className="deep-panel question-panel career-summary-panel">
      <p className="eyebrow">提交前确认</p>
      <h2>现实条件摘要</h2>
      <p className="deep-lead">这里只复述你确认过的现实条件，不提前给出职业结论。</p>
      <ul className="career-summary-list">
        {summarizeCareerCalibration(calibration).map((item) => <li key={item}>{item}</li>)}
      </ul>
      <div className="deep-actions">
        <button className="secondary-button" onClick={onEdit} type="button">返回修改</button>
        <button className="primary-button" onClick={onConfirm} type="button">确认并继续</button>
      </div>
    </section>
  );
}
