const SELECT_VOICES = {
  gojo: 'gojo-selected', toji: 'toji-selected',
  geto: 'geto-selected', ryu: 'ryu-selected', sukuna: 'sukuna-selected',
  choso: 'choso-selected', megumi: 'megumi-selected', yuji: 'yuji-selected', yuta: 'yuta-selected',
};

/** Pure routing from a character or shared battle event to a local clip key. */
export function voiceForSelection(characterId) {
  return SELECT_VOICES[characterId] ?? null;
}

export function voiceForBattleEvent(event) {
  if (event.type === 'black-flash') return 'yuji-black-flash';
  if (event.type === 'passive' && event.passive === 'Limitless') return 'gojo-limitless';
  if (event.type === 'mahoraga' && /takes over/i.test(event.text)) return 'megumi-mahoraga';
  if (event.type === 'move' && (event.move ?? event.effect) === 'SUKUNA_ULTIMATE') return 'sukuna-domain';
  if (event.type !== 'move') return null;

  switch (event.move ?? event.effect) {
    case 'REVERSAL_RED': return 'gojo-red';
    case 'AMPLIFICATION_BLUE': return 'gojo-blue';
    case 'HOLLOW_PURPLE': return 'gojo-hollow-purple';
    case 'NUE': return 'megumi-nue';
    case 'DIVINE_DOGS': return 'megumi-dogs';
    case 'MAHORAGA': return null;
    case 'MEGUMI_ULTIMATE': return 'megumi-domain';
    case 'CURSED_TOOLS': return 'toji-tools';
    case 'RIKA': return 'yuta-rika';
    case 'PIERCING_BLOOD': return 'choso-piercing-blood';
    case 'CHOSO_ULTIMATE': return 'choso-supernova';
    case 'CURSE_SWALLOW': return 'geto-swallow';
    case 'GETO_ULTIMATE': return 'geto-uzumaki';
    case 'GRANITE_BLAST': return 'ryu-granite-blast';
    case 'RYU_ULTIMATE': return 'ryu-sweet';
    case 'YUJI_ULTIMATE': return 'yuji-straight-hands';
    default: return null;
  }
}
