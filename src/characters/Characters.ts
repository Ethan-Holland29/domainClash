import { GESTURE_DEFINITIONS } from '../handTracking/GestureDefinitions';
import type { GameAction, GestureDefinition } from '../handTracking/GestureTypes';

export type MoveSlot = 'primary' | 'secondary' | 'ultimate';

export const MOVE_SLOTS: MoveSlot[] = ['primary', 'secondary', 'ultimate'];

/** Which game action each move slot triggers. The ultimate is always a Domain Expansion. */
export const SLOT_ACTION: Record<MoveSlot, GameAction> = {
  primary: 'PRIMARY_ATTACK',
  secondary: 'SECONDARY_ATTACK',
  ultimate: 'DOMAIN_EXPANSION',
};

export const SLOT_NAME: Record<MoveSlot, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  ultimate: 'Ultimate',
};

export interface CharacterDefinition {
  id: string;
  name: string;
  /** Accent colour for UI. */
  color: string;
  /** Gesture id (from GESTURE_DEFINITIONS) for each move slot. */
  moves: Record<MoveSlot, string>;
}

/** Playable roster. Add a character by listing three gesture ids from the sign library. */
export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'gojo',
    name: 'Gojo',
    color: '#4fc3f7',
    moves: { primary: 'lapse-blue', secondary: 'reversal-red', ultimate: 'unlimited-void' },
  },
  {
    id: 'sukuna',
    name: 'Sukuna',
    color: '#e53935',
    moves: { primary: 'cleave', secondary: 'dismantle', ultimate: 'malevolent-shrine' },
  },
  {
    id: 'megumi',
    name: 'Megumi',
    color: '#7e57c2',
    moves: { primary: 'divine-dogs', secondary: 'nue', ultimate: 'chimera-shadow-garden' },
  },
  {
    id: 'mahito',
    name: 'Mahito',
    color: '#66bb6a',
    moves: { primary: 'idle-transfiguration', secondary: 'polymorphic-soul-isomer', ultimate: 'self-embodiment-of-perfection' },
  },
];

/**
 * Resolves a character's three moves to gesture definitions. Throws on a
 * missing gesture id or a move placed in the wrong slot, so roster mistakes
 * show up immediately at startup.
 */
export function characterMoves(
  character: CharacterDefinition,
  library: GestureDefinition[] = GESTURE_DEFINITIONS,
): Record<MoveSlot, GestureDefinition> {
  const resolve = (slot: MoveSlot) => {
    const id = character.moves[slot];
    const def = library.find((d) => d.id === id);
    if (!def) throw new Error(`${character.name}: unknown gesture "${id}" for ${slot}`);
    if (def.action !== SLOT_ACTION[slot]) {
      throw new Error(`${character.name}: "${id}" triggers ${def.action}, but the ${slot} slot needs ${SLOT_ACTION[slot]}`);
    }
    return def;
  };
  return { primary: resolve('primary'), secondary: resolve('secondary'), ultimate: resolve('ultimate') };
}

export function findCharacter(id: string | null): CharacterDefinition | null {
  return CHARACTERS.find((c) => c.id === id) ?? null;
}
