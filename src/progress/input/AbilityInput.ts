import type { CharacterDefinition } from '../characters/CharacterTypes';
import { characterGestures } from '../characters/CharacterTypes';
import type { GestureType } from '../handTracking/GestureTypes';

export interface AbilityInput { characterId: string; gesture: GestureType; source: 'camera' | 'button'; }
export class AbilityInputBus {
  private listeners: ((input: AbilityInput) => void)[] = [];
  subscribe(listener: (input: AbilityInput) => void): void { this.listeners.push(listener); }
  send(character: CharacterDefinition, gesture: GestureType, source: AbilityInput['source']): void {
    if (!characterGestures(character).includes(gesture)) return;
    this.listeners.forEach(listener => listener({ characterId: character.id, gesture, source }));
  }
}
