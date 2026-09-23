type GeneratingModalProps = {
  /** False while the modal plays its exit animation. */
  open: boolean;
  stage: string;
  /** When provided, the waiting state offers a way out that also aborts the request. */
  onCancel?: () => void;
};

export function GeneratingModal({ open, stage, onCancel }: GeneratingModalProps) {
  useDocumentScrollLock(open);
  const stateClass = open ? '' : ' is-leaving';

  return (
    <div className={`generating-overlay${stateClass}`}>
      <div
        aria-label="正在生成报告"
        aria-modal="true"
        className={`generating-modal${stateClass}`}
        data-appearance="dark-glass"
        role="dialog"
      >
        <span aria-hidden="true" className="generating-orb" />
        <p aria-live="polite" className="generating-stage">
          {stage}
        </p>
        <div aria-hidden="true" className="progress-track">
          <span className="progress-bar" />
        </div>
        <p className="generating-note">通常需要 30–60 秒，生成的章节会先显示出来</p>
        {onCancel ? (
          <button className="generating-cancel" onClick={onCancel} type="button">
            取消生成
          </button>
        ) : null}
      </div>
    </div>
  );
}
import { useDocumentScrollLock } from '@/lib/use-document-scroll-lock';
