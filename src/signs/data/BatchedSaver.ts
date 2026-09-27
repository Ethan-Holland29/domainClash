import type { GestureSample } from './GestureDatasetTypes';

/**
 * Collects samples saved one at a time (the recorder saves every tracked
 * frame) and writes them in one storage call every `intervalMs`, so saving
 * keeps up with the camera. Each save() resolves once its sample is written;
 * a failed write rejects every sample in that batch.
 */
export class BatchedSaver {
  private queue: { sample: GestureSample; resolve: () => void; reject: (e: unknown) => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly write: (samples: GestureSample[]) => Promise<unknown>;
  private readonly intervalMs: number;
  private readonly maxBatch: number;

  constructor(write: (samples: GestureSample[]) => Promise<unknown>, intervalMs = 150, maxBatch = 60) {
    this.write = write;
    this.intervalMs = intervalMs;
    this.maxBatch = maxBatch;
  }

  save(sample: GestureSample): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ sample, resolve, reject });
      if (this.queue.length >= this.maxBatch) void this.flush();
      else this.timer ??= setTimeout(() => void this.flush(), this.intervalMs);
    });
  }

  /** Writes everything queued now. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    const batch = this.queue;
    this.queue = [];
    if (!batch.length) return;
    try {
      await this.write(batch.map((b) => b.sample));
      for (const b of batch) b.resolve();
    } catch (err) {
      for (const b of batch) b.reject(err);
    }
  }
}
