import type { GestureSnapshot } from '../handTracking/GestureTypes';

/** How many of the best-matching signs get a full per-check breakdown. */
const DETAILED_COUNT = 2;

/**
 * Debug view explaining why each gesture passes or fails: every check with
 * its 0..1 score and measured value. Toggle with the "D" key.
 */
export class GestureDebugPanel {
  private readonly element: HTMLDivElement;
  private readonly threshold: number;

  constructor(parent: HTMLElement, threshold: number) {
    this.threshold = threshold;
    this.element = document.createElement('div');
    this.element.className = 'gesture-debug';
    parent.appendChild(this.element);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') this.element.hidden = !this.element.hidden;
    });
  }

  update(snapshot: GestureSnapshot | null): void {
    if (this.element.hidden) return;
    if (!snapshot) {
      this.element.textContent = '';
      return;
    }
    const lines = [`Gesture checks (start >= ${this.threshold})   [D] hide`];
    const speed = `hand speed ${snapshot.handSpeed.toFixed(1)} palms/s`;
    lines.push(snapshot.moving ? `⚠ MOVING (${speed}) - hold still` : `  ${speed}`);
    for (const reason of snapshot.droppedHands) lines.push(`⚠ ignored ${reason}`);
    // Full breakdown for the closest matches only; the rest get one line.
    const ranked = [...snapshot.gestures].sort((a, b) => b.evaluation.score - a.evaluation.score);
    ranked.forEach(({ definition: def, score, evaluation: ev }, rank) => {
      const pass = score >= this.threshold;
      const guide = def.guideNumber ? `#${def.guideNumber} ` : '';
      const header = `${pass ? '✓' : '✗'} ${guide}${def.name}  ${score.toFixed(2)} (raw ${ev.score.toFixed(2)})`;
      if (rank >= DETAILED_COUNT) {
        const failing = ev.checks.find((c) => c.score < this.threshold);
        lines.push(`${header}${failing ? `  - ${failing.label}` : ''}`);
        return;
      }
      lines.push('', header, `    ${def.sign}`);
      for (const c of ev.checks) {
        const mark = c.score >= this.threshold ? '✓' : '✗';
        const tag = c.required ? ' [required]' : c.weight !== undefined ? ` [w${c.weight}]` : '';
        lines.push(`    ${mark} ${c.label.padEnd(28)} ${c.score.toFixed(2)}  ${c.detail}${tag}`);
      }
      if (rank === DETAILED_COUNT - 1) lines.push('');
    });
    this.element.textContent = lines.join('\n');
  }
}
