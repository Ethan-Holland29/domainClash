import { GameConfig } from "../config/GameConfig";

export class DomainMeter {
  private value = 0;
  readonly max = GameConfig.domain.meterMax;

  add(amount: number): void {
    this.value = Math.min(this.max, this.value + Math.max(0, amount));
  }

  isFull(): boolean {
    return this.value >= this.max;
  }

  reset(): void {
    this.value = 0;
  }

  get(): number {
    return this.value;
  }

  ratio(): number {
    return this.value / this.max;
  }
}
