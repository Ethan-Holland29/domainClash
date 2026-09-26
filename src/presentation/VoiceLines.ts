import type { AbilitySlot } from '../combat/AbilityTypes';

/**
 * Placeholder voice lines (spoken with text-to-speech). Replace any line
 * with a recording at src/assets/audio/voice-<character>-<slot>.mp3,
 * e.g. voice-sukuna-primary.mp3. Unlisted moves fall back to the move name.
 */
export const VOICE_LINES: Record<string, Partial<Record<AbilitySlot, string>>> = {
  gojo: { primary: 'Lapse. Blue.', secondary: 'Reversal. Red.', ultimate: 'Domain Expansion. Unlimited Void.' },
  sukuna: { primary: 'Cleave.', secondary: 'Dismantle.', ultimate: 'Domain Expansion. Malevolent Shrine.' },
  megumi: { primary: 'Divine Dogs!', secondary: 'Nue!', ultimate: 'Domain Expansion. Chimera Shadow Garden.' },
  mahito: {
    primary: 'Idle Transfiguration.',
    secondary: 'Polymorphic Soul Isomer.',
    ultimate: 'Domain Expansion. Self-Embodiment of Perfection.',
  },
};

export function voiceLine(characterId: string, slot: AbilitySlot, fallback: string): string {
  return VOICE_LINES[characterId]?.[slot] ?? fallback;
}
