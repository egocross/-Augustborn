import { DIRECTIONS } from '@/lib/deep-analysis/questions';
import type { DirectionId } from '@/lib/deep-analysis/types';

export function DirectionPicker({ onSelect }: { onSelect: (directionId: DirectionId) => void }) {
  return <section className="deep-panel deep-direction-panel">
    <div className="deep-panel-intro">
      <p className="eyebrow">深入探索</p>
      <h2>接下来，你最想进一步弄清楚什么？</h2>
      <p className="deep-lead">选择一个你现在最关心的问题。</p>
    </div>
    <div className="direction-grid">
      {DIRECTIONS.map((direction) => <button className="direction-card" key={direction.id} onClick={() => onSelect(direction.id)} type="button">
        <span className="direction-card-copy">
          <strong>{direction.title}</strong>
          <span>{direction.description}</span>
        </span>
        <span aria-hidden="true" className="direction-card-arrow">→</span>
      </button>)}
    </div>
  </section>;
}
