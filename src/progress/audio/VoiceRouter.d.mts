import type { BattleEvent } from '../../../shared/battle.mjs';

export type VoiceClip =
  | 'gojo-selected' | 'gojo-red' | 'gojo-blue' | 'gojo-limitless' | 'gojo-hollow-purple'
  | 'megumi-nue' | 'megumi-dogs' | 'megumi-treasure' | 'megumi-eight-grip' | 'megumi-mahoraga' | 'megumi-domain'
  | 'toji-selected' | 'toji-tools'
  | 'geto-selected' | 'geto-swallow' | 'geto-uzumaki'
  | 'ryu-selected' | 'ryu-granite-blast' | 'ryu-sweet';

export function voiceForSelection(characterId: string): VoiceClip | null;
export function voiceForBattleEvent(event: BattleEvent): VoiceClip | null;
