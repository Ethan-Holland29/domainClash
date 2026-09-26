/** Hit points that can never go below 0 or above max. */
export class HealthSystem {
  readonly max: number;
  private hp: number;

  constructor(max: number) {
    this.max = max;
    this.hp = max;
  }

  get current(): number {
    return this.hp;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  /** Applies damage, clamped at 0. Returns the damage actually dealt. */
  damage(amount: number): number {
    const dealt = Math.min(this.hp, Math.max(0, amount));
    this.hp -= dealt;
    return dealt;
  }

  reset(): void {
    this.hp = this.max;
  }
}
