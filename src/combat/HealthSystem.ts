export class HealthSystem {
  max: number;
  current: number;

  constructor(max: number, current: number = max) {
    this.max = max;
    this.current = current;
  }

  damage(amount: number): number {
    const applied = Math.min(this.current, Number.isFinite(amount) ? Math.max(0, amount) : 0);
    this.current = Math.max(0, this.current - applied);
    return applied;
  }

  isDead(): boolean {
    return this.current <= 0;
  }

  ratio(): number {
    return this.max <= 0 ? 0 : this.current / this.max;
  }

  reset(): void {
    this.current = this.max;
  }
}
