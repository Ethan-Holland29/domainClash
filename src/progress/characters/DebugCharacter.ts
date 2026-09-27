import type { CharacterDefinition } from './CharacterTypes';
import { ALL_GESTURES } from '../handTracking/GestureTypes';

/** Settings-only fighter used to exercise every known gesture without joining the combat roster. */
export const DEBUGGER_CHARACTER: CharacterDefinition = {
  id: 'debugger',
  name: 'Debugger',
  abilities: [...ALL_GESTURES],
  meter: 'domain',
  ultimate: null,
};
