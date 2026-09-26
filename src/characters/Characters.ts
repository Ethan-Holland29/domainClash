import roster from '../../server/roster.json' with {type: 'json'};
import type { AbilityId } from '../combat/AbilityTypes';
export interface Character { id: string; name: string; moves: AbilityId[] }
export const CHARACTERS = roster as Character[];
export function characterById(id: string): Character {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
}
