import { GESTURE_LABELS, type GestureType } from '../handTracking/GestureTypes';
import type { TrackedHand } from '../handTracking/HandTypes';
import type { PoseLibrary } from './PoseLibrary';

export class RecognitionInspector {
  private select: HTMLSelectElement;
  private status: HTMLElement;
  private rows: object[] = [];
  private last = 0;
  private library: PoseLibrary;
  constructor(container: HTMLElement, library: PoseLibrary) {
    this.library = library;
    container.innerHTML = `<h2>Check a problem sign</h2><label>Expected sign <select id="inspect-sign"></select></label><p id="inspect-status" role="status">Waiting for camera.</p><button id="inspect-export">Export diagnostic report</button><p>This reports missing hands, pose mismatch, or competing signs. The report contains scores and hand counts, not video. If hands overlap and tracking loses a hand, try separating them slightly or use an easier substitute pose for that move.</p>`;
    this.select = container.querySelector('#inspect-sign')!;
    this.status = container.querySelector('#inspect-status')!;
    this.select.onchange = () => { this.rows = []; };
    container.querySelector<HTMLButtonElement>('#inspect-export')!.onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ expected: this.select.value, frames: this.rows }, null, 2)], {type:'application/json'}));
      const a = document.createElement('a'); a.href = url; a.download = 'domainclash-diagnostic.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    };
  }
  setMoves(moves: GestureType[]): void {
    this.select.innerHTML = moves.map(g => `<option value="${g}">${GESTURE_LABELS[g]}</option>`).join(''); this.rows = [];
  }
  update(hands: TrackedHand[], aspect: number, moves: GestureType[], now: number): void {
    if (now - this.last < 200) return;
    this.last = now;
    const target = this.select.value as GestureType;
    const expectedCounts = [...new Set((this.library.data[target] ?? []).map(p=>p.length))];
    const evaluations = this.library.evaluate(hands, aspect, moves);
    const targetResult = evaluations.find(e=>e.gesture===target)!;
    const nearest = evaluations.find(e=>e.debug.error !== null);
    const error = targetResult.debug.error;
    let reason = 'Pose matches. Hold steady for confirmation.';
    if (!expectedCounts.length) reason = 'No recording saved for this sign. Import your backup or record it.';
    else if (!expectedCounts.includes(hands.length)) reason = `Tracking sees ${hands.length} hand(s); this sign needs ${expectedCounts.join(' or ')}. Keep both palms visible if using two hands.`;
    else if (error === null) reason = 'Palm tracking is too small or invalid. Move closer to the camera.';
    else if (targetResult.debug.checks.stableBestCandidate) reason = 'Strongest match: hold for one second for the more tolerant confirmation.';
    else if (!targetResult.debug.checks.closeToReference) reason = 'The tracked pose differs from your recordings. Adjust your angle or add this variation as another example.';
    else if (!targetResult.matched) reason = 'This pose is too similar to another sign. Use a more distinct pose.';
    this.status.textContent = `${GESTURE_LABELS[target]}: ${reason} ${error != null ? `Difference ${error.toFixed(3)} / allowed ${targetResult.debug.limit?.toFixed(3)} (lower is better).` : ''} ${nearest ? `Closest: ${GESTURE_LABELS[nearest.gesture]}.` : ''}`;
    this.rows.push({ time: now, expected: target, hands: hands.length, expectedCounts, reason, evaluations });
    if (this.rows.length > 150) this.rows.shift();
  }
}
