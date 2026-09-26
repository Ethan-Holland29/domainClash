import type { GestureType } from '../handTracking/GestureTypes';

export interface CharacterDefinition {
  id: string;
  name: string;
  abilities: GestureType[];
  abilityGroup?: string;
  // Metadata for future combat; no resource gains or costs are implemented yet.
  meter: 'domain' | 'blood' | 'ultimate';
  ultimate: { name: string; gesture: GestureType } | null;
}

/** Only a selected character's assigned signs may produce ability input. */
export function characterGestures(character: CharacterDefinition): GestureType[] {
  return [...new Set([...character.abilities, ...(character.ultimate ? [character.ultimate.gesture] : [])])];
}
