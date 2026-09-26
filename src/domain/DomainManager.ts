import { DEFAULT_DOMAIN_EFFECT, type DomainEffect } from './DomainEffects';
import { DomainMeter } from './DomainMeter';
import { DomainState, type DomainUpdate } from './DomainState';

export type DomainActivation =
  | { activated: true; state: DomainState }
  | { activated: false; reason: 'meter'; meter: number }
  | { activated: false; reason: 'already-active' };

/**
 * Gatekeeper and owner of Domain Expansion: the hand sign can be made at any
 * time, but a domain only opens with a full meter and never while one is
 * already up. Opening empties the meter; the meter does not fill while a
 * domain is active (no chaining).
 */
export class DomainManager {
  readonly meter = new DomainMeter();
  private effect: DomainEffect = DEFAULT_DOMAIN_EFFECT;
  private active: DomainState | null = null;
  private activations = 0;

  get activationCount(): number {
    return this.activations;
  }

  /** The domain currently up, if any. */
  current(now: number): DomainState | null {
    return this.active?.isActive(now) ? this.active : null;
  }

  /** Which effect the next domain uses (set per character). */
  setEffect(effect: DomainEffect): void {
    this.effect = effect;
  }

  tryActivate(name: string, now: number): DomainActivation {
    if (this.current(now)) return { activated: false, reason: 'already-active' };
    if (!this.meter.isFull) return { activated: false, reason: 'meter', meter: this.meter.value };
    this.meter.reset();
    this.activations++;
    this.active = new DomainState(name, this.effect, now);
    return { activated: true, state: this.active };
  }

  /** Meter gain from a landed attack (none while a domain is up). */
  addMeter(amount: number, now: number): number {
    return this.current(now) ? 0 : this.meter.add(amount);
  }

  /** Advances the active domain; returns its ticks and end. */
  update(now: number): DomainUpdate[] {
    if (!this.active) return [];
    const updates = this.active.update(now);
    if (updates.some((u) => u.type === 'ended')) this.active = null;
    return updates;
  }

  /** Force-ends the active domain (match over). Returns true if one was up. */
  endActive(): boolean {
    const had = this.active !== null;
    this.active?.end();
    this.active = null;
    return had;
  }

  reset(): void {
    this.meter.reset();
    this.active = null;
    this.activations = 0;
  }
}
