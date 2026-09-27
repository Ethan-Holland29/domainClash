/**
 * HandDebugRenderer
 *
 * Draws detected hand landmarks/connections onto a canvas overlaid on
 * the webcam feed. Pure rendering — knows nothing about gestures or
 * combat. Full drawing logic (including mirroring correction) lands
 * in Milestone 1; this scaffold sets up the canvas plumbing.
 */

import type { HandTrackingResult } from "../handTracking/HandTypes";
import { HAND_CONNECTIONS } from "../handTracking/HandTypes";

const HAND_COLORS: Record<string, string> = {
  Left: "#4fd1c5",
  Right: "#f6ad55",
};

export class HandDebugRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not acquire 2D rendering context for debug canvas.");
    }
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draws landmarks/connections for the given frame.
   *
   * The video element is displayed mirrored (CSS scaleX(-1)) for a
   * natural selfie view, but MediaPipe's landmark coordinates are
   * given in the *unmirrored* frame. We mirror the x coordinate here
   * so the overlay lines up with what the user actually sees.
   */
  render(result: HandTrackingResult): void {
    this.clear();

    const { width, height } = this.canvas;

    for (const hand of result.hands) {
      const color = HAND_COLORS[hand.handedness] ?? "#e2e8f0";
      const points = hand.landmarks.map((lm) => ({
        x: (1 - lm.x) * width, // mirror to match the mirrored video
        y: lm.y * height,
      }));

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = points[a];
        const pb = points[b];
        if (!pa || !pb) continue;
        this.ctx.moveTo(pa.x, pa.y);
        this.ctx.lineTo(pb.x, pb.y);
      }
      this.ctx.stroke();

      this.ctx.fillStyle = color;
      for (const p of points) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
}
