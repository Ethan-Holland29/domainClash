import type { TrackedHand } from '../handTracking/HandTypes';

export const PREPARE_MS = 5000;
export const CAPTURE_MS = 2000;
export const MOVEMENT_GRACE_MS = 300;
const PALM_POINTS = [0, 5, 9, 13, 17];
const MAX_PALM_MOVEMENT = 0.4;

// MediaPipe does not expose per-finger visibility here. Use palm anchors in
// image space for recording stability, never inferred finger tips or depth.
export function palmsStable(current: TrackedHand[], reference: TrackedHand[], aspect: number): boolean {
  if (current.length !== reference.length || !current.length) return false;
  function matches(a: TrackedHand, b: TrackedHand): boolean {
    const scale = Math.hypot((b.landmarks[9].x - b.landmarks[0].x) * aspect, b.landmarks[9].y - b.landmarks[0].y);
    if (scale < 0.015) return false;
    const movement = PALM_POINTS.map(i => Math.hypot((a.landmarks[i].x - b.landmarks[i].x) * aspect, a.landmarks[i].y - b.landmarks[i].y) / scale).sort((x, y) => x - y);
    // A single noisy palm anchor must not cancel a recording either.
    return movement[2] < MAX_PALM_MOVEMENT;
  }
  return current.every((h, i) => matches(h, reference[i])) ||
    (current.length === 2 && matches(current[0], reference[1]) && matches(current[1], reference[0]));
}
