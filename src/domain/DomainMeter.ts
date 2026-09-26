export const DOMAIN_METER_MAX = 100;

/** Domain Meter: 0..100, filled by landing attacks, emptied by a Domain Expansion. */
export class DomainMeter {
  private amount = 0;

  get value(): number {
    return this.amount;
  }

  get isFull(): boolean {
    return this.amount >= DOMAIN_METER_MAX;
  }

  /** Adds meter, capped at 100. Returns the amount actually added. */
  add(value: number): number {
    const before = this.amount;
    this.amount = Math.min(DOMAIN_METER_MAX, this.amount + Math.max(0, value));
    return this.amount - before;
  }

  reset(): void {
    this.amount = 0;
  }
}
