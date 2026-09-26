export class CooldownManager {
  private remaining = new Map<string, number>();

  start(id: string, durationMs: number): void {
    this.remaining.set(id, durationMs);
  }

  isReady(id: string): boolean {
    return (this.remaining.get(id) ?? 0) <= 0;
  }

  remainingMs(id: string): number {
    return Math.max(0, this.remaining.get(id) ?? 0);
  }

  update(dtMs: number): void {
    for (const [id, value] of this.remaining) {
      const next = value - dtMs;
      if (next <= 0) this.remaining.delete(id);
      else this.remaining.set(id, next);
    }
  }

  reset(): void {
    this.remaining.clear();
  }
}
