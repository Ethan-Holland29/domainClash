import type { CharacterDefinition } from './CharacterTypes';

export const CHARACTERS: CharacterDefinition[] = [
  { id: 'gojo', name: 'Satoru Gojo', abilities: ['BASIC_PUNCH', 'REVERSAL_RED', 'AMPLIFICATION_BLUE', 'HOLLOW_PURPLE'], meter: 'domain', ultimate: { name: 'Domain Expansion: Unlimited Void', gesture: 'GOJO_ULTIMATE' } },
  { id: 'megumi', name: 'Megumi Fushiguro', abilityGroup: 'Ten Shadows: Shikigami Summon', abilities: ['BASIC_PUNCH', 'NUE', 'DIVINE_DOGS', 'MAHORAGA'], meter: 'domain', ultimate: { name: 'Domain Expansion: Chimera Shadow Garden', gesture: 'MEGUMI_ULTIMATE' } },
  { id: 'sukuna', name: 'Ryomen Sukuna', abilities: ['BASIC_PUNCH', 'CLEAVE'], meter: 'domain', ultimate: { name: 'Domain Expansion: Malevolent Shrine', gesture: 'SUKUNA_ULTIMATE' } },
  { id: 'choso', name: 'Choso', abilities: ['BASIC_PUNCH', 'PIERCING_BLOOD'], meter: 'blood', ultimate: { name: 'Supernova', gesture: 'CHOSO_ULTIMATE' } },
  { id: 'ryu', name: 'Ryu Ishigori', abilities: ['BASIC_PUNCH', 'GRANITE_BLAST'], meter: 'ultimate', ultimate: { name: 'Way Too Sweet!', gesture: 'RYU_ULTIMATE' } },
  { id: 'yuji', name: 'Yuji Itadori', abilities: ['BASIC_PUNCH', 'CURSED_FISTS'], meter: 'ultimate', ultimate: { name: 'Straight Hands', gesture: 'YUJI_ULTIMATE' } },
  { id: 'toji', name: 'Toji Fushiguro', abilities: ['BASIC_PUNCH', 'CURSED_TOOLS'], meter: 'ultimate', ultimate: null },
  { id: 'geto', name: 'Suguru Geto', abilities: ['BASIC_PUNCH', 'CURSE_SWALLOW'], meter: 'domain', ultimate: { name: 'Maximum: Uzumaki', gesture: 'GETO_ULTIMATE' } },
  { id: 'yuta', name: 'Yuta Okkotsu', abilities: ['BASIC_PUNCH', 'RIKA'], meter: 'domain', ultimate: { name: 'Copy', gesture: 'YUTA_ULTIMATE' } },
];
