import type { DomainEffect } from './DomainEffects';

export type DomainUpdate = { type: 'tick'; damage: number } | { type: 'ended' };

/**
 * One active Domain Expansion: activation -> active duration with periodic
 * sure-hit ticks and modifiers -> end/cleanup. Times are on the combat clock.
 */
export class DomainState {
  readonly name: string;
  readonly effect: DomainEffect;
  readonly startedAt: number;
  private nextTickAt: number;
  private ended = false;

  constructor(name: string, effect: DomainEffect, now: number) {
    this.name = name;
    this.effect = effect;
    this.startedAt = now;
    this.nextTickAt = now + effect.tickIntervalMs;
  }

  get endsAt(): number {
    return this.startedAt + this.effect.durationMs;
  }

  isActive(now: number): boolean {
    return !this.ended && now < this.endsAt;
  }

  remaining(now: number): number {
    return this.ended ? 0 : Math.max(0, this.endsAt - now);
  }

  /** Advances to `now`: returns the ticks that happened and, once, the end. */
  update(now: number): DomainUpdate[] {
    if (this.ended) return [];
    const out: DomainUpdate[] = [];
    while (this.nextTickAt <= now && this.nextTickAt <= this.endsAt) {
      out.push({ type: 'tick', damage: this.effect.tickDamage });
      this.nextTickAt += this.effect.tickIntervalMs;
    }
    if (now >= this.endsAt) {
      this.ended = true;
      out.push({ type: 'ended' });
    }
    return out;
  }

  /** Ends early (e.g. the match ended). */
  end(): void {
    this.ended = true;
  }
}
