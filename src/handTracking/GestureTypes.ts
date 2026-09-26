/**
 * Gesture type definitions for DomainClash.
 *
 * Names are drawn from the character/move list in the project brief so
 * they read clearly in the debug HUD, but every pose defined in
 * GestureDefinitions.ts is an original shape designed for reliable
 * webcam recognition — not a reproduction of any specific choreography.
 */

export type GestureType =
  | "REVERSAL_RED"
  | "AMPLIFICATION_BLUE"
  | "GRANITE_BLAST"
  | "GOJO_ULTIMATE"
  | "RYU_ULTIMATE"
  | "BASIC_PUNCH"
  | "CLEAVE"
  | "PIERCING_BLOOD"
  | "DIVINE_DOGS"
  | "NUE"
  | "MAHORAGA"
  | "SUKUNA_ULTIMATE"
  | "CHOSO_ULTIMATE"
  | "MEGUMI_ULTIMATE"
  | "YUJI_ULTIMATE"
  | "CURSED_TOOLS"
  | "CURSE_SWALLOW"
  | "GETO_ULTIMATE"
  | "RIKA"
  | "YUTA_ULTIMATE";

export const ALL_GESTURES: GestureType[] = [
  "YUJI_ULTIMATE",
  "CURSED_TOOLS",
  "CURSE_SWALLOW",
  "GETO_ULTIMATE",
  "RIKA",
  "YUTA_ULTIMATE",

  "REVERSAL_RED",
  "AMPLIFICATION_BLUE",
  "GRANITE_BLAST",
  "GOJO_ULTIMATE",
  "RYU_ULTIMATE",
  "BASIC_PUNCH",
  "CLEAVE",
  "PIERCING_BLOOD",
  "DIVINE_DOGS",
  "NUE",
  "MAHORAGA",
  "SUKUNA_ULTIMATE",
  "CHOSO_ULTIMATE",
  "MEGUMI_ULTIMATE",
];

/** How many hands a gesture requires, and how long it must be held to confirm. */
export interface GestureConfig {
  requiredHands: 1 | 2;
  holdMs: number;
}

export const DEFAULT_GESTURE_CONFIG: Record<GestureType, GestureConfig> = {
  YUJI_ULTIMATE: { requiredHands: 1, holdMs: 900 },
  CURSED_TOOLS: { requiredHands: 1, holdMs: 500 },
  CURSE_SWALLOW: { requiredHands: 1, holdMs: 500 },
  GETO_ULTIMATE: { requiredHands: 1, holdMs: 900 },
  RIKA: { requiredHands: 1, holdMs: 500 },
  YUTA_ULTIMATE: { requiredHands: 1, holdMs: 900 },

  REVERSAL_RED: { requiredHands: 1, holdMs: 500 },
  AMPLIFICATION_BLUE: { requiredHands: 1, holdMs: 500 },
  GRANITE_BLAST: { requiredHands: 1, holdMs: 500 },
  GOJO_ULTIMATE: { requiredHands: 1, holdMs: 900 },
  RYU_ULTIMATE: { requiredHands: 1, holdMs: 900 },
  BASIC_PUNCH: { requiredHands: 1, holdMs: 300 },
  CLEAVE: { requiredHands: 1, holdMs: 500 },
  PIERCING_BLOOD: { requiredHands: 2, holdMs: 500 },
  DIVINE_DOGS: { requiredHands: 1, holdMs: 600 },
  NUE: { requiredHands: 2, holdMs: 600 },
  MAHORAGA: { requiredHands: 2, holdMs: 700 },
  SUKUNA_ULTIMATE: { requiredHands: 2, holdMs: 900 },
  CHOSO_ULTIMATE: { requiredHands: 2, holdMs: 900 },
  MEGUMI_ULTIMATE: { requiredHands: 2, holdMs: 900 },
};

export type GesturePhase = "idle" | "candidate" | "confirmed" | "cooldown";

export interface GestureDebugInfo {
  error?: number | null;
  limit?: number;
  /** Per-check pass/fail, for the Milestone 2B debug panel. */
  checks: Record<string, boolean>;
  score: number; // 0-1, fraction of checks passed
}

export interface GestureEvaluation {
  requiredHoldMs?: number;
  gesture: GestureType;
  matched: boolean;
  debug: GestureDebugInfo;
}

export interface GestureRecognitionState {
  phase: GesturePhase;
  candidateGesture: GestureType | null;
  confirmedGesture: GestureType | null;
  holdProgress: number; // 0-1
  debug: GestureEvaluation[];
}

// Storage IDs stay stable so existing recordings remain compatible.
export const GESTURE_LABELS: Record<GestureType, string> = {
  YUJI_ULTIMATE: 'Straight Hands',
  CURSED_TOOLS: 'Cursed Tools',
  CURSE_SWALLOW: 'Curse Swallow',
  GETO_ULTIMATE: 'Maximum: Uzumaki',
  RIKA: 'Rika',
  YUTA_ULTIMATE: 'Copy',

  BASIC_PUNCH: 'Basic Punch',
  REVERSAL_RED: 'Reversal: Red',
  AMPLIFICATION_BLUE: 'Amplification: Blue',
  GRANITE_BLAST: 'Granite Blast',
  CLEAVE: 'Cleave',
  PIERCING_BLOOD: 'Piercing Blood',
  DIVINE_DOGS: 'Demon Dogs',
  NUE: 'Nue',
  MAHORAGA: 'Mahoraga',
  GOJO_ULTIMATE: 'Domain Expansion: Unlimited Void',
  MEGUMI_ULTIMATE: 'Domain Expansion: Chimera Shadow Garden',
  SUKUNA_ULTIMATE: 'Domain Expansion: Malevolent Shrine',
  CHOSO_ULTIMATE: 'Supernova',
  RYU_ULTIMATE: 'Way Too Sweet!',
};
