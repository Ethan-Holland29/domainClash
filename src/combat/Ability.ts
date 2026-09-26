import { DEFAULT_ABILITY_STATS, type AbilitySlot, type AbilityStats } from './AbilityTypes';

/** One usable ability: which slot it fills, its display name, and its numbers. */
export interface Ability {
  slot: AbilitySlot;
  name: string;
  stats: AbilityStats;
}

/** Builds a character's three abilities from their move names, with default stats per slot. */
export function createAbilities(
  names: Record<AbilitySlot, string>,
  stats: Record<AbilitySlot, AbilityStats> = DEFAULT_ABILITY_STATS,
): Record<AbilitySlot, Ability> {
  return {
    primary: { slot: 'primary', name: names.primary, stats: stats.primary },
    secondary: { slot: 'secondary', name: names.secondary, stats: stats.secondary },
    ultimate: { slot: 'ultimate', name: names.ultimate, stats: stats.ultimate },
  };
}
