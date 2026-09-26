import type { GestureEvent, GestureSnapshot } from '../handTracking/GestureTypes';
import { FINGER_NAMES } from '../handTracking/HandGeometry';
import type { HandFrame } from '../handTracking/HandTypes';

export interface DebugStats {
  status: string;
  fps: number;
  frame: HandFrame | null;
  gesture: GestureSnapshot | null;
}

const EVENT_LOG_SIZE = 6;

/** Text overlay for debug info (hands, FPS, gestures). */
export class DebugHUD {
  readonly element: HTMLDivElement;
  private readonly events: string[] = [];

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'debug-hud';
    parent.appendChild(this.element);
  }

  setLines(lines: string[]): void {
    this.element.textContent = lines.join('\n');
  }

  logEvent(event: GestureEvent): void {
    const t = (event.timestampMs / 1000).toFixed(2);
    this.events.unshift(`${t}s ${event.type.padEnd(9)} ${event.gesture.name}`);
    this.events.length = Math.min(this.events.length, EVENT_LOG_SIZE);
  }

  update({ status, fps, frame, gesture }: DebugStats): void {
    const hands = frame?.hands ?? [];
    const lines = [status, `FPS: ${fps.toFixed(0)}`, `Hands: ${hands.length}`];

    // Finger states: ^ extended, v folded, ~ ambiguous (thumb index middle ring pinky).
    for (const a of gesture?.hands ?? []) {
      const fingers = FINGER_NAMES.map((f) => {
        const e = a.fingers[f].extended;
        return e >= 0.6 ? '^' : e <= 0.4 ? 'v' : '~';
      }).join('');
      const bends = FINGER_NAMES.map((f) => a.fingers[f].bendDeg.toFixed(0).padStart(3)).join(' ');
      const conf = (a.hand.handednessScore * 100).toFixed(0);
      lines.push(`  ${a.hand.handedness.padEnd(7)} ${conf.padStart(3)}%  TIMRP ${fingers}  bend°${bends}`);
    }

    if (gesture) {
      lines.push('');
      const name = gesture.active ? `${gesture.active.name} (${gesture.active.action})` : '-';
      const candidate = gesture.phase === 'candidate' ? name : '-';
      const confirmed = gesture.phase === 'confirmed' ? name : '-';
      lines.push(`Candidate: ${candidate}`);
      lines.push(`Confirmed: ${confirmed}`);
      lines.push(`Hold: ${progressBar(gesture.holdProgress)} ${(gesture.holdProgress * 100).toFixed(0)}%`);
      lines.push('Scores:');
      for (const g of gesture.gestures) {
        const cdText = g.cooldownMs > 0 ? `  debounce ${g.cooldownMs.toFixed(0)}ms` : '';
        lines.push(`  ${g.definition.name.padEnd(23)} ${g.score.toFixed(2)}${cdText}`);
      }
    }

    if (this.events.length > 0) {
      lines.push('', 'Events:', ...this.events.map((e) => `  ${e}`));
    }
    this.setLines(lines);
  }
}

function progressBar(progress: number, width = 12): string {
  const filled = Math.round(progress * width);
  return `[${'#'.repeat(filled)}${'.'.repeat(width - filled)}]`;
}
