/** Reusable cooldown tracker. All times are on the caller's clock (ms). */
export class CooldownManager<K extends string = string> {
  private readonly readyAt = new Map<K, number>();

  start(key: K, now: number, durationMs: number): void {
    if (durationMs > 0) this.readyAt.set(key, now + durationMs);
  }

  remaining(key: K, now: number): number {
    return Math.max(0, (this.readyAt.get(key) ?? 0) - now);
  }

  isReady(key: K, now: number): boolean {
    return this.remaining(key, now) === 0;
  }

  reset(): void {
    this.readyAt.clear();
  }
}
