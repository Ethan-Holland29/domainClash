import type { GestureType } from '../handTracking/GestureTypes';

export interface CharacterDefinition {
  id: string;
  name: string;
  abilities: GestureType[];
  abilityGroup?: string;
  // Named roster moves awaiting combat rules and recorded signs.
  plannedKit?: { technique: string | null; ultimate: string | null };
  // All resource types share the universal gains and full-meter ultimate cost.
  meter: 'domain' | 'blood' | 'ultimate';
  ultimate: { name: string; gesture: GestureType } | null;
}

/** Only a selected character's assigned signs may produce ability input. */
export function characterGestures(character: CharacterDefinition): GestureType[] {
  const gestures: GestureType[] = [...character.abilities, ...(character.ultimate ? [character.ultimate.gesture] : []), 'GUARD'];
  return [...new Set(gestures)];
}
