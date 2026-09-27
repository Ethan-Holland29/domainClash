/**
 * handGeometry
 *
 * Pure math helpers for interpreting a single hand's 21 landmarks:
 * finger extension state, normalized distances, and hand scale.
 * No knowledge of specific gestures lives here — GestureDefinitions
 * composes these primitives into actual gesture checks.
 */

import type { Landmark, TrackedHand } from "./HandTypes";
import { HAND_LANDMARK } from "./HandTypes";

export function distance(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function distance2D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * A rough, hand-size-independent scale factor: the distance from the
 * wrist to the middle finger's MCP joint. Used to normalize distance
 * thresholds so gestures work regardless of hand size or camera distance.
 */
export function handScale(hand: TrackedHand): number {
  const wrist = hand.landmarks[HAND_LANDMARK.WRIST];
  const middleMcp = hand.landmarks[HAND_LANDMARK.MIDDLE_FINGER_MCP];
  return distance2D(wrist, middleMcp) || 0.0001; // avoid divide-by-zero
}

export interface FingerExtensionState {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

/**
 * A non-thumb finger is considered "extended" when its tip is farther
 * from the wrist than its PIP joint is — i.e. the finger is straightened
 * outward rather than curled into the palm.
 */
function isNonThumbExtended(hand: TrackedHand, tipIdx: number, pipIdx: number): boolean {
  const wrist = hand.landmarks[HAND_LANDMARK.WRIST];
  const tip = hand.landmarks[tipIdx];
  const pip = hand.landmarks[pipIdx];
  return distance2D(wrist, tip) > distance2D(wrist, pip) * 1.05;
}

/**
 * The thumb doesn't curl the same way as other fingers, so we check its
 * tip distance from the index finger's MCP (the base of the palm on the
 * thumb side) relative to hand scale instead.
 */
function isThumbExtended(hand: TrackedHand): boolean {
  const tip = hand.landmarks[HAND_LANDMARK.THUMB_TIP];
  const indexMcp = hand.landmarks[HAND_LANDMARK.INDEX_FINGER_MCP];
  const scale = handScale(hand);
  return distance2D(tip, indexMcp) > scale * 0.9;
}

export function getFingerExtension(hand: TrackedHand): FingerExtensionState {
  return {
    thumb: isThumbExtended(hand),
    index: isNonThumbExtended(hand, HAND_LANDMARK.INDEX_FINGER_TIP, HAND_LANDMARK.INDEX_FINGER_PIP),
    middle: isNonThumbExtended(hand, HAND_LANDMARK.MIDDLE_FINGER_TIP, HAND_LANDMARK.MIDDLE_FINGER_PIP),
    ring: isNonThumbExtended(hand, HAND_LANDMARK.RING_FINGER_TIP, HAND_LANDMARK.RING_FINGER_PIP),
    pinky: isNonThumbExtended(hand, HAND_LANDMARK.PINKY_TIP, HAND_LANDMARK.PINKY_PIP),
  };
}

export function countExtended(state: FingerExtensionState): number {
  return Object.values(state).filter(Boolean).length;
}

/**
 * Ratio of (tip-to-wrist distance) to (PIP-to-wrist distance) for a
 * single finger. Roughly: ~1.5-2+ = fully extended/straight,
 * ~0.9-1.3 = partially curled ("hooked"), <0.8 = curled into a fist.
 * Used for poses like Chimera Shadow Garden where fingers are hooked
 * rather than fully extended or fully closed.
 */
function fingerCurlRatio(hand: TrackedHand, tipIdx: number, pipIdx: number): number {
  const wrist = hand.landmarks[HAND_LANDMARK.WRIST];
  const tip = hand.landmarks[tipIdx];
  const pip = hand.landmarks[pipIdx];
  const pipDist = distance2D(wrist, pip) || 0.0001;
  return distance2D(wrist, tip) / pipDist;
}

export interface FingerCurlState {
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

export function getFingerCurlRatios(hand: TrackedHand): FingerCurlState {
  return {
    index: fingerCurlRatio(hand, HAND_LANDMARK.INDEX_FINGER_TIP, HAND_LANDMARK.INDEX_FINGER_PIP),
    middle: fingerCurlRatio(hand, HAND_LANDMARK.MIDDLE_FINGER_TIP, HAND_LANDMARK.MIDDLE_FINGER_PIP),
    ring: fingerCurlRatio(hand, HAND_LANDMARK.RING_FINGER_TIP, HAND_LANDMARK.RING_FINGER_PIP),
    pinky: fingerCurlRatio(hand, HAND_LANDMARK.PINKY_TIP, HAND_LANDMARK.PINKY_PIP),
  };
}

/** True if a curl ratio falls in the "hooked" band: not straight, not a closed fist. */
export function isHookedRatio(ratio: number): boolean {
  return ratio >= 0.85 && ratio <= 1.25;
}

/** Average pairwise spread between adjacent fingertips, normalized by hand scale. */
export function fingerSpread(hand: TrackedHand): number {
  const tips = [
    HAND_LANDMARK.THUMB_TIP,
    HAND_LANDMARK.INDEX_FINGER_TIP,
    HAND_LANDMARK.MIDDLE_FINGER_TIP,
    HAND_LANDMARK.RING_FINGER_TIP,
    HAND_LANDMARK.PINKY_TIP,
  ].map((i) => hand.landmarks[i]);

  const scale = handScale(hand);
  let total = 0;
  for (let i = 0; i < tips.length - 1; i++) {
    total += distance2D(tips[i], tips[i + 1]);
  }
  return total / (tips.length - 1) / scale;
}

export function centroid(hand: TrackedHand): Landmark {
  const sum = hand.landmarks.reduce(
    (acc, lm) => ({ x: acc.x + lm.x, y: acc.y + lm.y, z: acc.z + lm.z }),
    { x: 0, y: 0, z: 0 },
  );
  const n = hand.landmarks.length;
  return { x: sum.x / n, y: sum.y / n, z: sum.z / n };
}
