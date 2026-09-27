/**
 * DebugHUD
 *
 * Renders developer-facing tracking stats (hand count, handedness,
 * confidence, FPS) into a plain DOM overlay. Kept separate from any
 * future player-facing HUD so debug info can be hidden later without
 * touching game UI.
 */

export interface DebugStats {
  handsDetected: number;
  handedness: string[];
  fps: number;
  candidateGesture?: string | null;
  confirmedGesture?: string | null;
  holdProgress?: number; // 0-1
}

export class DebugHUD {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "debug-hud";
    container.appendChild(this.el);
  }

  update(stats: DebugStats): void {
    const progressPct = Math.round((stats.holdProgress ?? 0) * 100);
    this.el.innerHTML = `
      <div>Hands detected: ${stats.handsDetected}</div>
      <div>Handedness: ${stats.handedness.join(", ") || "-"}</div>
      <div>FPS: ${stats.fps.toFixed(1)}</div>
      <div>Candidate gesture: ${stats.candidateGesture ?? "-"}</div>
      <div>Confirmed gesture: ${stats.confirmedGesture ?? "-"}</div>
      <div>Hold progress: ${progressPct}%</div>
    `;
  }

  setMessage(message: string): void {
    this.el.textContent = message;
  }
}
