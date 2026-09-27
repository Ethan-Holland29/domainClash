/**
 * A single normalized landmark in display space: x/y in 0..1 across the
 * video frame as the user sees it (already mirrored if the view is mirrored).
 * z is relative depth, with the wrist as origin (smaller = closer to camera).
 */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/** The user's actual hand (corrected for mirroring). */
export type Handedness = 'Left' | 'Right' | 'Unknown';

/** One tracked hand: 21 landmarks plus handedness info. */
export interface TrackedHand {
  landmarks: Landmark[];
  /**
   * The same 21 points in real-world metres, centred on the hand. Scale- and
   * distance-independent, so it is the right space for finger angles.
   * Mirrored along x like `landmarks` when the view is mirrored.
   */
  worldLandmarks: Landmark[];
  handedness: Handedness;
  /** MediaPipe's confidence in the handedness classification (0..1). */
  handednessScore: number;
}

/** Result of processing a single video frame. */
export interface HandFrame {
  hands: TrackedHand[];
  timestampMs: number;
  /** Video width / height, to convert normalized x/y into equal units. */
  aspectRatio: number;
}

export interface HandTrackerOptions {
  wasmPath: string;
  modelPath: string;
  numHands: number;
  minHandDetectionConfidence: number;
  minHandPresenceConfidence: number;
  minTrackingConfidence: number;
  /** Mirror landmarks horizontally to match a mirrored (selfie) display. */
  mirrored: boolean;
  /**
   * Swap MediaPipe's Left/Right labels. Verified with tasks-vision 1.0.1 on
   * raw (unmirrored) frames: labels already match the user's real hand, so
   * this defaults to false. Flip it if a camera/driver pre-mirrors frames.
   */
  invertHandedness: boolean;
}

/** MediaPipe hand landmark indices. */
export const HandLandmarkIndex = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export const LANDMARKS_PER_HAND = 21;

/** Pairs of landmark indices forming the hand skeleton. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm
  [5, 9], [9, 13], [13, 17],
];
