/**
 * How forgiving gesture recognition is, as a fraction of each check's range.
 *
 * Players move around and rarely hold a textbook pose, so every check is
 * loosened by this much: both the point where a measurement earns full
 * credit and the point where it fails move this fraction of the range
 * toward the lenient side. 0 = strict (the tuned values as written),
 * 0.3 = roughly "30% bad form still counts".
 */
export const GESTURE_TOLERANCE = 0.3;

/**
 * Applies GESTURE_TOLERANCE to a ramp range (see ramp() in HandGeometry):
 * `zeroAt` is where a check fails, `oneAt` where it fully passes.
 */
export function lenient(zeroAt: number, oneAt: number): { zeroAt: number; oneAt: number } {
  const shift = (zeroAt - oneAt) * GESTURE_TOLERANCE;
  return { zeroAt: zeroAt + shift, oneAt: oneAt + shift };
}
