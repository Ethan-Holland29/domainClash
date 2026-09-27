import type { TrackedHand } from './HandTypes';

/** Game actions a gesture can trigger. Combat only ever sees these. */
export type GameAction = 'PRIMARY_ATTACK' | 'SECONDARY_ATTACK' | 'DOMAIN_EXPANSION' | 'GUARD';

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

export interface FingerState {
  /** Total bend along the finger in degrees (0 = perfectly straight). */
  bendDeg: number;
  /** 0 = clearly folded, 1 = clearly extended, in between = ambiguous. */
  extended: number;
}

/** Pre-computed geometry for one hand, shared by every gesture definition. */
export interface HandAnalysis {
  hand: TrackedHand;
  /** Video width / height; multiply normalized x by this to get square units. */
  aspectRatio: number;
  fingers: Record<FingerName, FingerState>;
  /** Palm centre in aspect-corrected image units (x scaled by aspect ratio). */
  palmCenter: { x: number; y: number };
  /** Wrist to middle-finger knuckle length, in the same units as palmCenter. */
  palmSize: number;
  /** Centre of the four fingertips (index..pinky), same units as palmCenter. */
  tipCenter: { x: number; y: number };
  /** Centre of the four finger knuckles (MCPs), same units as palmCenter. */
  knuckleCenter: { x: number; y: number };
  /** Wrist to middle-finger knuckle length in metres (world space). */
  worldPalmSize: number;
  /**
   * Unit normal of the palm plane in world space (camera-aligned axes:
   * x right, y down, z away). Its sign depends on handedness, so gestures
   * should compare magnitudes/axes rather than rely on direction.
   */
  palmNormal: { x: number; y: number; z: number };
}

export interface GestureContext {
  /** Hands trusted for rule-based signs (after HandFilter). */
  hands: HandAnalysis[];
  /**
   * Every detected hand, unfiltered - exactly what the dataset recorder
   * saves. Learned signs compare against this so live data matches the
   * recordings (e.g. palms pressed together often come out as two
   * same-handedness detections, which HandFilter would merge).
   */
  allHands: HandAnalysis[];
}

/** One named condition of a gesture, for the debug view. */
export interface GestureCheck {
  label: string;
  /** 0..1; the gesture's score is the minimum of its checks. */
  score: number;
  /** Measured value, e.g. "bend 152deg" or "0.8 palms". */
  detail: string;
  /** Weight in a weighted-score gesture (default 1). */
  weight?: number;
  /** In a weighted-score gesture: failing this check vetoes the gesture. */
  required?: boolean;
}

export interface GestureEvaluation {
  /** 0..1 overall match (weakest check, or weighted total for weighted gestures). */
  score: number;
  checks: GestureCheck[];
}

export interface GestureDefinition {
  /** Unique id, e.g. "malevolent-shrine". Several gestures may share an action. */
  id: string;
  /**
   * Label of this sign in the recorded gesture dataset, e.g. "MALEVOLENT_SHRINE".
   * With enough samples of it, the sign is matched against the recordings.
   */
  datasetLabel: string;
  action: GameAction;
  /** Technique / domain name shown in the UI, e.g. "Malevolent Shrine". */
  name: string;
  /** Character the sign belongs to, if any. */
  character?: string;
  /** Number of the sign in the hand-sign reference guide. */
  guideNumber?: number;
  /** Short description of the physical hand sign. */
  sign: string;
  /** True when there is no built-in rule: the move only works once taught with recorded samples. */
  taughtOnly?: boolean;
  /** Overrides the recognizer's default hold duration. */
  holdMs?: number;
  /** Scores the current hands against this gesture and explains why. */
  evaluate(ctx: GestureContext): GestureEvaluation;
}

export type GestureEventType =
  | 'enter' // gesture became the candidate; hold timer started
  | 'confirmed' // held long enough; this is when the action fires
  | 'cancelled' // candidate lost before being confirmed
  | 'released'; // a confirmed gesture was let go

export interface GestureEvent {
  type: GestureEventType;
  action: GameAction;
  /** The specific gesture, e.g. which domain's hand sign was made. */
  gesture: GestureDefinition;
  timestampMs: number;
  score: number;
}

export type GesturePhase = 'idle' | 'candidate' | 'confirmed';

/** Live status of one gesture, for UI/debugging. */
export interface GestureStatus {
  definition: GestureDefinition;
  /** Smoothed score (what decisions use). */
  score: number;
  /** This frame's raw evaluation with per-check breakdown. */
  evaluation: GestureEvaluation;
  /** Remaining debounce after release, in ms. */
  cooldownMs: number;
}

/** Snapshot of recognizer state, for UI/debugging. */
export interface GestureSnapshot {
  phase: GesturePhase;
  /** The candidate or confirmed gesture. */
  active: GestureDefinition | null;
  /** 0..1 progress towards confirmation (1 once confirmed). */
  holdProgress: number;
  /** Current smoothed score of the active gesture. */
  score: number;
  gestures: GestureStatus[];
  /** Hands used for recognition (after filtering). */
  hands: HandAnalysis[];
  /** Why detected hands were ignored this frame. */
  droppedHands: string[];
  /** Fastest hand movement, in palm sizes per second. */
  handSpeed: number;
  /** True when hands move too fast for any gesture to count. */
  moving: boolean;
}

export interface GestureRecognizerConfig {
  /** How long a gesture must be held before it fires. */
  holdMs: number;
  /** Minimum smoothed score (0..1) for a gesture to start, and to confirm. */
  enterThreshold: number;
  /** Lower score an already-active gesture may drop to without being lost (hysteresis). */
  releaseThreshold: number;
  /** A new gesture only starts if it beats the runner-up by this much (rejects ambiguous poses). */
  ambiguityMargin: number;
  /** Time constant of score smoothing; filters single-frame spikes. */
  scoreSmoothingMs: number;
  /** Hands moving faster than this (palm sizes / second) are mid-transition; nothing counts. */
  maxHandSpeed: number;
  /** Tolerated tracking dropout before a held/candidate gesture is lost. */
  releaseGraceMs: number;
  /** After release, the same gesture cannot start again for this long. */
  debounceMs: number;
}
