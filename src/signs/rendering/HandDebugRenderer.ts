import { HAND_CONNECTIONS, type HandFrame, type Handedness } from '../handTracking/HandTypes';

const HAND_COLORS: Record<Handedness, string> = {
  Left: '#3fa9f5',
  Right: '#f5a623',
  Unknown: '#cccccc',
};

/**
 * Draws hand landmarks over the webcam feed. The canvas backing store is
 * sized to the video's native resolution and styled with the same
 * object-fit as the <video>, so normalized landmarks line up 1:1.
 */
export class HandDebugRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  /** Match the canvas backing store to the video resolution. */
  resize(width: number, height: number): void {
    const { canvas } = this.ctx;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  draw(frame: HandFrame): void {
    const { ctx } = this;
    const { width: w, height: h } = ctx.canvas;
    const scale = Math.max(w, h) / 1280;
    this.clear();

    for (const hand of frame.hands) {
      const color = HAND_COLORS[hand.handedness];
      const pts = hand.landmarks;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(pts[a].x * w, pts[a].y * h);
        ctx.lineTo(pts[b].x * w, pts[b].y * h);
      }
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * scale;
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      const wrist = pts[0];
      ctx.font = `bold ${Math.round(18 * scale)}px system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(hand.handedness, wrist.x * w, wrist.y * h + 28 * scale);
    }
  }
}
