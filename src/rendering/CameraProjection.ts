import { isDomain } from "../combat/MoveCatalog";
import type { TrackedHand, Vec3 } from '../handTracking/HandTypes';
import { evaluateGestures } from '../handTracking/GestureDefinitions';
import { AbilityId } from '../combat/AbilityTypes';

export interface Point { x: number; y: number }
export interface Anchor { origin: Point; direction: Point; scale: number }

/** Mirror once. The full camera image and landmarks use the same contain transform. */
export function coverTransform(width: number, height: number, videoWidth: number, videoHeight: number) {
  const scale = Math.max(width / Math.max(1, videoWidth), height / Math.max(1, videoHeight));
  const drawnWidth = videoWidth * scale, drawnHeight = videoHeight * scale;
  return { x: (width - drawnWidth) / 2, y: (height - drawnHeight) / 2, width: drawnWidth, height: drawnHeight };
}

export function containTransform(width: number, height: number, videoWidth: number, videoHeight: number) {
  const scale = Math.min(width / Math.max(1, videoWidth), height / Math.max(1, videoHeight));
  const drawnWidth = videoWidth * scale, drawnHeight = videoHeight * scale;
  return { x: (width - drawnWidth) / 2, y: (height - drawnHeight) / 2, width: drawnWidth, height: drawnHeight };
}

export function projectLandmark(p: Vec3, width: number, height: number, vw: number, vh: number): Point {
  const rect = containTransform(width, height, vw, vh);
  return { x: width - (rect.x + p.x * rect.width), y: rect.y + p.y * rect.height };
}

export function handAnchor(id: AbilityId, hands: TrackedHand[], width: number, height: number,
  vw: number, vh: number, fallback: Point): Anchor {
  const valid = hands.filter(h => h.landmarks.length === 21);
  if (!valid.length) return { origin: { x: fallback.x * width, y: fallback.y * height }, direction: { x: .8, y: -.6 }, scale: Math.min(width, height) * .09 };
  const project = (p: Vec3) => projectLandmark(p, width, height, vw, vh);
  const selected = [...valid].sort((a,b) => {
    const score = (h: TrackedHand) => evaluateGestures([h]).find(e => e.id === id)?.score ?? 0;
    return score(b) - score(a);
  })[0];
  const points = selected.landmarks;
  const wrist = project(points[0]), middle = project(points[9]);
  const palm = { x: (wrist.x + middle.x) / 2, y: (wrist.y + middle.y) / 2 };
  const tip = project(points[8]), base = project(points[5]);
  const length = Math.hypot(tip.x - base.x, tip.y - base.y);
  const direction = length > 8 ? { x: (tip.x - base.x) / length, y: (tip.y - base.y) / length } : { x: .8, y: -.6 };
  let origin = (id === AbilityId.SECONDARY_ATTACK || id === AbilityId.UNLIMITED_VOID) ? tip : palm;
  if (isDomain(id) && id !== AbilityId.UNLIMITED_VOID && valid.length > 1) {
    const other = valid[1].landmarks;
    const a = project(valid[0].landmarks[9]), b = project(other[9]);
    origin = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return { origin, direction, scale: Math.max(22, Math.min(150, Math.hypot(middle.x - wrist.x, middle.y - wrist.y))) };
}
