const SELECT_VOICES = {
  gojo: 'gojo-selected', toji: 'toji-selected',
  geto: 'geto-selected', ryu: 'ryu-selected',
};

/** Pure routing from a character or shared battle event to a local clip key. */
export function voiceForSelection(characterId) {
  return SELECT_VOICES[characterId] ?? null;
}

export function voiceForBattleEvent(event) {
  if (event.type === 'passive' && event.passive === 'Limitless') return 'gojo-limitless';
  if (event.type === 'mahoraga' && /takes over/i.test(event.text)) return 'megumi-mahoraga';
  if (event.type !== 'move') return null;

  switch (event.move ?? event.effect) {
    case 'REVERSAL_RED': return 'gojo-red';
    case 'AMPLIFICATION_BLUE': return 'gojo-blue';
    case 'HOLLOW_PURPLE': return 'gojo-hollow-purple';
    case 'NUE': return 'megumi-nue';
    case 'DIVINE_DOGS': return 'megumi-dogs';
    case 'MAHORAGA': return 'megumi-treasure';
    case 'MEGUMI_ULTIMATE': return 'megumi-domain';
    case 'CURSED_TOOLS': return 'toji-tools';
    case 'CURSE_SWALLOW': return 'geto-swallow';
    case 'GETO_ULTIMATE': return 'geto-uzumaki';
    case 'GRANITE_BLAST': return 'ryu-granite-blast';
    case 'RYU_ULTIMATE': return 'ryu-sweet';
    default: return null;
  }
}
