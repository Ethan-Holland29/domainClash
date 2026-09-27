import type { BattleEvent } from '../../../shared/battle.mjs';
export type BattleSfx = 'shield-block' | 'sword-slashes' | 'cursed-fists-fire' | `punch-${1 | 2 | 3 | 4}`;
export function sfxForBattleEvent(event: BattleEvent, random?: () => number): BattleSfx[];
