/** The three abilities every character has. Matches the character move slots. */
export type AbilitySlot = 'primary' | 'secondary' | 'ultimate';

export const ABILITY_SLOTS: AbilitySlot[] = ['primary', 'secondary', 'ultimate'];

export interface AbilityStats {
  /** Damage dealt to the opponent when the ability lands. */
  damage: number;
  /** Time before the ability can be used again (0 = no cooldown). */
  cooldownMs: number;
  /** Domain Meter gained when the ability lands (never on a miss/block). */
  meterGain: number;
  /**
   * Wind-up before impact. The move is committed (and its cooldown starts)
   * when cast; damage - or a block - is decided at impact, in sync with the
   * attack animation. 0 = instant.
   */
  windupMs: number;
}

/**
 * Starting balance. Tuning happens in Milestone 7; keep every combat number here.
 * The ultimate (Domain Expansion) has no cooldown: it is gated by a full Domain Meter.
 *
 * Damage is kept low relative to meter gain so the meter fills around half the
 * opponent's HP (10 primaries = 50 dmg, or 5 secondaries = 55 dmg) - otherwise
 * the opponent is dead before the Domain is ever usable.
 */
export const DEFAULT_ABILITY_STATS: Record<AbilitySlot, AbilityStats> = {
  primary: { damage: 5, cooldownMs: 1500, meterGain: 10, windupMs: 150 },
  secondary: { damage: 11, cooldownMs: 5000, meterGain: 20, windupMs: 700 },
  // Opening hit only: the Domain's sure-hit ticks and boosted attacks add the rest (see domain/DomainEffects).
  ultimate: { damage: 10, cooldownMs: 0, meterGain: 0, windupMs: 0 },
};

export const MAX_HP = 100;
