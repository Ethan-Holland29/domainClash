/** Pure routing from resolved combat events to short sound-effect keys. */
export function sfxForBattleEvent(event, random = Math.random) {
  if (event?.type === 'passive' && event.passive === 'Shadow Dweller') return ['sword-slashes'];
  if (event?.type !== 'move') return [];

  switch (event.move ?? event.effect) {
    case 'GUARD': return ['shield-block'];
    case 'BASIC_PUNCH': return [`punch-${1 + Math.min(3, Math.floor(random() * 4))}`];
    case 'YUJI_ULTIMATE': return ['punch-3', 'punch-3', 'punch-3', 'punch-4'];
    case 'CURSED_FISTS': return ['cursed-fists-fire'];
    case 'CLEAVE':
    case 'CURSED_TOOLS': return ['sword-slashes'];
    default: return [];
  }
}
