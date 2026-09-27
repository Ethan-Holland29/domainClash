import type { TrackedHand } from "../handTracking/HandTypes";
import { LandmarkIndex } from "../handTracking/HandTypes";

const CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

export class HandDebugRenderer {
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  draw(video: HTMLVideoElement, hands: TrackedHand[]): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const width = video.videoWidth || this.canvas.clientWidth;
    const height = video.videoHeight || this.canvas.clientHeight;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.canvas.parentElement) this.canvas.parentElement.style.aspectRatio = `${width} / ${height}`;
    ctx.clearRect(0, 0, width, height);

    for (const hand of hands) {
      const color = hand.handedness === "Left" ? "#7ee0ff" : "#ffb347";
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";

      for (const [a, b] of CONNECTIONS) {
        const pa = hand.landmarks[a];
        const pb = hand.landmarks[b];
        ctx.beginPath();
        ctx.moveTo(pa.x * width, pa.y * height);
        ctx.lineTo(pb.x * width, pb.y * height);
        ctx.stroke();
      }

      for (const point of hand.landmarks) {
        ctx.fillStyle = point === hand.landmarks[LandmarkIndex.WRIST] ? "#fff" : color;
        ctx.beginPath();
        ctx.arc(point.x * width, point.y * height, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  clear(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
