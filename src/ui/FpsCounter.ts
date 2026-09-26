/** Exponentially smoothed frames-per-second estimate. */
export class FpsCounter {
  private lastMs: number | null = null;
  private smoothed = 0;
  private readonly smoothing: number;

  constructor(smoothing = 0.9) {
    this.smoothing = smoothing;
  }

  get fps(): number {
    return this.smoothed;
  }

  tick(nowMs: number): number {
    if (this.lastMs !== null) {
      const dt = nowMs - this.lastMs;
      if (dt > 0) {
        const instant = 1000 / dt;
        this.smoothed = this.smoothed === 0 ? instant : this.smoothed * this.smoothing + instant * (1 - this.smoothing);
      }
    }
    this.lastMs = nowMs;
    return this.smoothed;
  }

  reset(): void {
    this.lastMs = null;
    this.smoothed = 0;
  }
}
