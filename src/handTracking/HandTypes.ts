/**
 * Shared types for hand-tracking data, decoupled from MediaPipe's own
 * result shape so the rest of the app (gestures, combat, rendering)
 * never has to import MediaPipe types directly.
 */

export interface Landmark {
  x: number; // normalized 0-1, relative to video frame width
  y: number; // normalized 0-1, relative to video frame height
  z: number; // relative depth, smaller is closer to camera
}

export type Handedness = "Left" | "Right";

export interface TrackedHand {
  worldLandmarks?: Landmark[];
  landmarks: Landmark[]; // 21 landmarks, MediaPipe hand landmark order
  handedness: Handedness;
  handednessScore: number; // 0-1 confidence in left/right classification
}

export interface HandTrackingResult {
  hands: TrackedHand[];
  timestampMs: number;
}

/** Indices into the 21-point landmark array, per MediaPipe's hand model. */
export const HAND_LANDMARK = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

/** Pairs of landmark indices to draw as bone/connection lines. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm base
];
