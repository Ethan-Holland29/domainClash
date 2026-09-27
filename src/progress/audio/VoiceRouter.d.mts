import type { BattleEvent } from '../../../shared/battle.mjs';

export type VoiceClip =
  | 'gojo-selected' | 'gojo-red' | 'gojo-blue' | 'gojo-limitless' | 'gojo-hollow-purple'
  | 'megumi-nue' | 'megumi-dogs' | 'megumi-treasure' | 'megumi-eight-grip' | 'megumi-mahoraga' | 'megumi-domain'
  | 'toji-selected' | 'toji-tools'
  | 'geto-selected' | 'geto-swallow' | 'geto-uzumaki'
  | 'ryu-selected' | 'ryu-granite-blast' | 'ryu-sweet'
  | 'sukuna-selected' | 'sukuna-domain' | 'choso-selected' | 'choso-piercing-blood' | 'choso-supernova' | 'megumi-selected'
  | 'yuji-selected' | 'yuji-straight-hands' | 'yuji-black-flash' | 'yuta-selected' | 'yuta-rika';

export function voiceForSelection(characterId: string): VoiceClip | null;
export function voiceForBattleEvent(event: BattleEvent): VoiceClip | null;
