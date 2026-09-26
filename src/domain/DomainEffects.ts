/**
 * What a Domain Expansion does once it is up. Reusable for any character:
 * add an entry to DOMAIN_EFFECTS (or rely on the default).
 */
export interface DomainEffect {
  /** How long the domain lasts (combat time, so it does not run during the cinematic). */
  durationMs: number;
  /** "Sure-hit": automatic damage to the opponent every tick. */
  tickIntervalMs: number;
  tickDamage: number;
  /** Player attacks deal this much more damage while the domain is up. */
  damageMultiplier: number;
  /** Player attacks cannot be blocked while the domain is up. */
  sureHit: boolean;
  /** The opponent cannot act while the domain is up. */
  stunsOpponent: boolean;
}

export const DEFAULT_DOMAIN_EFFECT: DomainEffect = {
  durationMs: 10000,
  tickIntervalMs: 1000,
  tickDamage: 2,
  damageMultiplier: 1.5,
  sureHit: true,
  stunsOpponent: false,
};

/**
 * Per-character twists. Every domain lands roughly the same total sure-hit
 * damage (~20 over its duration) so none is an instant win.
 */
export const DOMAIN_EFFECTS: Record<string, Partial<DomainEffect>> = {
  // Malevolent Shrine: relentless cuts, many small hits.
  sukuna: { tickIntervalMs: 500, tickDamage: 1 },
  // Unlimited Void: the opponent is frozen by infinite information.
  gojo: { stunsOpponent: true, tickDamage: 1, tickIntervalMs: 800 },
  // Chimera Shadow Garden: slower, heavier shikigami strikes.
  megumi: { tickIntervalMs: 2000, tickDamage: 4 },
  // Self-Embodiment of Perfection: touching the soul directly.
  mahito: { damageMultiplier: 2, tickDamage: 1 },
};

export function domainEffectFor(characterId: string): DomainEffect {
  return { ...DEFAULT_DOMAIN_EFFECT, ...DOMAIN_EFFECTS[characterId] };
}
