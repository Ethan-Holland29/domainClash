import type { HandFrame } from '../handTracking/HandTypes';
import type { GestureLabel, GestureSample } from './GestureDatasetTypes';
import { createSample } from './GestureSampleFactory';

export interface RecorderConfig {
  /** Time to get into the pose after pressing Record. */
  countdownMs: number;
  /** Samples captured per recording. */
  samplesPerBurst: number;
  /** Minimum time between captured samples. */
  intervalMs: number;
  /** Stop early if no hands are seen for this long in a row. */
  noHandsTimeoutMs: number;
}

export const DEFAULT_RECORDER_CONFIG: RecorderConfig = {
  countdownMs: 3000,
  samplesPerBurst: 100,
  intervalMs: 100,
  noHandsTimeoutMs: 3000,
};

/**
 * Captures a burst of samples (100 by default) for one label: countdown, then one
 * sample per interval from frames that contain at least one hand. Each
 * sample is handed to `save` immediately (nothing is batched).
 */
export class GestureRecorder {
  readonly config: RecorderConfig;
  onStatus: ((text: string) => void) | null = null;
  private readonly getFrame: () => HandFrame | null;
  private readonly save: (sample: GestureSample) => Promise<void>;
  private runId = 0;
  private _busy = false;

  constructor(
    getFrame: () => HandFrame | null,
    save: (sample: GestureSample) => Promise<void>,
    config: Partial<RecorderConfig> = {},
  ) {
    this.getFrame = getFrame;
    this.save = save;
    this.config = { ...DEFAULT_RECORDER_CONFIG, ...config };
  }

  get busy(): boolean {
    return this._busy;
  }

  cancel(): void {
    if (!this._busy) return;
    this.runId++;
    this._busy = false;
    this.onStatus?.('Recording cancelled.');
  }

  /** Records one burst. Resolves with the number of samples saved. */
  async record(label: GestureLabel): Promise<number> {
    if (this._busy) return 0;
    this._busy = true;
    const run = ++this.runId;
    const alive = () => run === this.runId;
    try {
      for (let left = Math.ceil(this.config.countdownMs / 1000); left > 0; left--) {
        this.onStatus?.(`Get into ${label}... ${left}`);
        await sleep(1000);
        if (!alive()) return 0;
      }

      let saved = 0;
      let lastTimestamp = -1;
      let lastHandsSeen = performance.now();
      while (saved < this.config.samplesPerBurst && performance.now() - lastHandsSeen < this.config.noHandsTimeoutMs) {
        const tickStart = performance.now();
        const frame = this.getFrame();
        if (frame && frame.hands.length > 0) lastHandsSeen = tickStart;
        if (frame && frame.hands.length > 0 && frame.timestampMs !== lastTimestamp) {
          lastTimestamp = frame.timestampMs;
          await this.save(createSample(label, frame));
          saved++;
          this.onStatus?.(`Recording ${label}: ${saved}/${this.config.samplesPerBurst}`);
        } else if (!frame || frame.hands.length === 0) {
          this.onStatus?.(`Recording ${label}: no hands visible...`);
        }
        // Interval is measured from the start of this tick, so save time does not stretch the burst.
        await sleep(Math.max(0, this.config.intervalMs - (performance.now() - tickStart)));
        if (!alive()) return saved;
      }
      this.onStatus?.(
        saved === this.config.samplesPerBurst
          ? `Saved ${saved} ${label} samples.`
          : `Saved ${saved} ${label} samples (stopped early: no hands for ${this.config.noHandsTimeoutMs / 1000}s).`,
      );
      return saved;
    } finally {
      if (alive()) this._busy = false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
