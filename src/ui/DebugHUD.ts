import type { TrackedHand } from "../handTracking/HandTypes";
import type { GestureEval } from "../handTracking/GestureTypes";
import type { GestureState } from "../handTracking/GestureTypes";

export class DebugHUD {
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  render(args: {
    hands: TrackedHand[];
    fps: number;
    gesture: GestureState;
    evals: GestureEval[];
    cameraError: string | null;
  }): void {
    const { hands, fps, gesture, evals, cameraError } = args;
    const handLines = hands
      .map((h, i) => `#${i + 1} ${h.handedness} · handedness ${(h.score * 100).toFixed(0)}%`)
      .join("<br>") || "none";

    const evalHtml = evals
      .map((ev) => {
        const checks = ev.checks
          .map(
            (c) =>
              `<li class="${c.passed ? "ok" : "fail"}">${c.passed ? "✓" : "✗"} ${c.name} (${c.value.toFixed(2)}) — ${c.detail}</li>`,
          )
          .join("");
        return `<div class="eval ${ev.passed ? "passed" : ""}"><strong>${ev.displayName}</strong> ${ev.score.toFixed(2)}
          <ul>${checks}</ul></div>`;
      })
      .join("");

    this.root.innerHTML = `
      <div class="debug-title">Debug <span>press D to hide</span></div>
      ${cameraError ? `<div class="debug-error">${cameraError}</div>` : ""}
      <div>Hands: <strong>${hands.length}</strong></div>
      <div>${handLines}</div>
      <div>FPS: <strong>${fps.toFixed(0)}</strong></div>
      <div>Candidate: ${gesture.candidate ?? "—"} · phase ${gesture.phase}</div>
      <div>Confirmed: ${gesture.confirmed ?? "—"}</div>
      <div>Hold: ${(gesture.holdProgress * 100).toFixed(0)}% · score ${gesture.score.toFixed(2)}</div>
      <div class="hint">Keys: 1 Primary · 2 Secondary · 3 Domain · D debug</div>
      ${evalHtml}
    `;
  }
}
