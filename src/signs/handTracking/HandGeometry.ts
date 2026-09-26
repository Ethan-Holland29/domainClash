import type { FingerName, FingerState, HandAnalysis } from './GestureTypes';

type Vec2 = { x: number; y: number };
import { HandLandmarkIndex as L, type HandFrame, type Landmark, type TrackedHand } from './HandTypes';

/**
 * Bend thresholds (degrees) mapping a finger's total bend to an 0..1
 * "extended" score. Calibrated on real MediaPipe output: relaxed open fingers
 * measure ~60-100 deg (the wrist->knuckle offset alone adds ~20-30), a fist ~200+.
 */
export const FINGER_BEND_THRESHOLDS = {
  /** At or below this total bend a finger counts as fully extended. */
  extendedMaxDeg: 80,
  /** At or above this total bend a finger counts as fully folded. */
  foldedMinDeg: 170,
  /** The thumb bends less, so it gets its own range. */
  thumbExtendedMaxDeg: 35,
  thumbFoldedMinDeg: 80,
};

/**
 * Landmark chains used to measure bend. For the four fingers the chain is
 * wrist -> MCP -> PIP -> DIP -> tip (bend at MCP, PIP, DIP). For the thumb
 * it is CMC -> MCP -> IP -> tip (bend at MCP and IP).
 */
const FINGER_CHAINS: Record<FingerName, number[]> = {
  thumb: [L.THUMB_CMC, L.THUMB_MCP, L.THUMB_IP, L.THUMB_TIP],
  index: [L.WRIST, L.INDEX_MCP, L.INDEX_PIP, L.INDEX_DIP, L.INDEX_TIP],
  middle: [L.WRIST, L.MIDDLE_MCP, L.MIDDLE_PIP, L.MIDDLE_DIP, L.MIDDLE_TIP],
  ring: [L.WRIST, L.RING_MCP, L.RING_PIP, L.RING_DIP, L.RING_TIP],
  pinky: [L.WRIST, L.PINKY_MCP, L.PINKY_PIP, L.PINKY_DIP, L.PINKY_TIP],
};

export const FINGER_NAMES: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

/** Angle in degrees between segment a->b and segment b->c (0 = collinear). */
export function bendAngleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vx = c.x - b.x, vy = c.y - b.y, vz = c.z - b.z;
  const lenProduct = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz);
  if (lenProduct === 0) return 0;
  const cos = (ux * vx + uy * vy + uz * vz) / lenProduct;
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function fingerState(world: Landmark[], finger: FingerName): FingerState {
  const chain = FINGER_CHAINS[finger];
  let bendDeg = 0;
  for (let i = 1; i < chain.length - 1; i++) {
    bendDeg += bendAngleDeg(world[chain[i - 1]], world[chain[i]], world[chain[i + 1]]);
  }
  const t = FINGER_BEND_THRESHOLDS;
  const [lo, hi] = finger === 'thumb' ? [t.thumbExtendedMaxDeg, t.thumbFoldedMinDeg] : [t.extendedMaxDeg, t.foldedMinDeg];
  return { bendDeg, extended: clamp01((hi - bendDeg) / (hi - lo)) };
}

export function analyzeHand(hand: TrackedHand, aspectRatio: number): HandAnalysis {
  // World landmarks are metric and distance-independent; fall back to image
  // landmarks if MediaPipe did not supply them.
  const world = hand.worldLandmarks.length === hand.landmarks.length ? hand.worldLandmarks : hand.landmarks;
  const fingers = Object.fromEntries(FINGER_NAMES.map((f) => [f, fingerState(world, f)])) as Record<
    FingerName,
    FingerState
  >;

  // Image-space measurements use x scaled by aspect ratio so x and y share units.
  const p = (i: number) => ({ x: hand.landmarks[i].x * aspectRatio, y: hand.landmarks[i].y });
  const palmCenter = centroid([L.WRIST, L.INDEX_MCP, L.MIDDLE_MCP, L.RING_MCP, L.PINKY_MCP].map(p));
  const tipCenter = centroid([L.INDEX_TIP, L.MIDDLE_TIP, L.RING_TIP, L.PINKY_TIP].map(p));
  const knuckleCenter = centroid([L.INDEX_MCP, L.MIDDLE_MCP, L.RING_MCP, L.PINKY_MCP].map(p));
  const palmSize = distance2(p(L.WRIST), p(L.MIDDLE_MCP));

  return {
    hand,
    aspectRatio,
    fingers,
    palmCenter,
    palmSize,
    tipCenter,
    knuckleCenter,
    worldPalmSize: distance3(world[L.WRIST], world[L.MIDDLE_MCP]),
    palmNormal: palmNormal(world),
  };
}

function centroid(points: Vec2[]): Vec2 {
  return {
    x: points.reduce((s, q) => s + q.x, 0) / points.length,
    y: points.reduce((s, q) => s + q.y, 0) / points.length,
  };
}

function distance2(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distance3(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Unit normal of the plane through wrist, index knuckle and pinky knuckle. */
function palmNormal(world: Landmark[]): Landmark {
  const w = world[L.WRIST], i = world[L.INDEX_MCP], k = world[L.PINKY_MCP];
  const ux = i.x - w.x, uy = i.y - w.y, uz = i.z - w.z;
  const vx = k.x - w.x, vy = k.y - w.y, vz = k.z - w.z;
  const n = { x: uy * vz - uz * vy, y: uz * vx - ux * vz, z: ux * vy - uy * vx };
  const len = Math.hypot(n.x, n.y, n.z) || 1;
  return { x: n.x / len, y: n.y / len, z: n.z / len };
}

/**
 * Linear 0..1 ramp: 0 at `zeroAt`, 1 at `oneAt`, clamped. Works in either
 * direction, e.g. ramp(d, 0.5, 0.3) scores smaller distances higher.
 */
export function ramp(value: number, zeroAt: number, oneAt: number): number {
  if (zeroAt === oneAt) return value >= oneAt ? 1 : 0;
  return Math.min(1, Math.max(0, (value - zeroAt) / (oneAt - zeroAt)));
}

/** Distance between two fingertips of one hand, in (world) palm sizes. */
export function tipGapInPalms(a: HandAnalysis, tipA: number, tipB: number): number {
  const world = a.hand.worldLandmarks.length ? a.hand.worldLandmarks : a.hand.landmarks;
  return a.worldPalmSize > 0 ? distance3(world[tipA], world[tipB]) / a.worldPalmSize : Infinity;
}

export function analyzeFrame(frame: HandFrame): HandAnalysis[] {
  return frame.hands.map((h) => analyzeHand(h, frame.aspectRatio));
}

/**
 * Distance between two palm centres measured in palm sizes, so the value is
 * the same whether the player stands close to or far from the camera.
 */
export function palmDistanceInPalms(a: HandAnalysis, b: HandAnalysis): number {
  const avgPalm = (a.palmSize + b.palmSize) / 2;
  if (avgPalm === 0) return Infinity;
  return distance2(a.palmCenter, b.palmCenter) / avgPalm;
}

/** How upright the hand is: 1 = fingers straight up in the image, 0 = sideways, <0 = down. */
export function uprightness(a: HandAnalysis): number {
  const dx = a.knuckleCenter.x - a.palmCenter.x;
  const dy = a.knuckleCenter.y - a.palmCenter.y;
  const len = Math.hypot(dx, dy);
  return len > 0 ? -dy / len : 0;
}

/** A landmark in aspect-corrected image units (same units as palmCenter). */
export function imagePoint(a: HandAnalysis, index: number): Vec2 {
  const p = a.hand.landmarks[index];
  return { x: p.x * a.aspectRatio, y: p.y };
}

/** Distance between a landmark on hand `a` and one on hand `b`, in palm sizes. */
export function crossHandDistanceInPalms(a: HandAnalysis, indexA: number, b: HandAnalysis, indexB: number): number {
  const avgPalm = (a.palmSize + b.palmSize) / 2;
  return avgPalm > 0 ? distance2(imagePoint(a, indexA), imagePoint(b, indexB)) / avgPalm : Infinity;
}

/**
 * How far the index and middle fingertips have swapped sides, in palm sizes,
 * measured across the hand (perpendicular to wrist -> middle knuckle).
 * Negative when the fingers are side by side as normal, positive when crossed.
 */
export function indexMiddleCrossing(a: HandAnalysis): number {
  const wrist = imagePoint(a, L.WRIST);
  const mid = imagePoint(a, L.MIDDLE_MCP);
  const upLen = Math.hypot(mid.x - wrist.x, mid.y - wrist.y) || 1;
  const across = { x: -(mid.y - wrist.y) / upLen, y: (mid.x - wrist.x) / upLen };
  const side = (from: number, to: number) => {
    const p = imagePoint(a, from), q = imagePoint(a, to);
    return (q.x - p.x) * across.x + (q.y - p.y) * across.y;
  };
  const knuckleSide = Math.sign(side(L.INDEX_MCP, L.MIDDLE_MCP)) || 1;
  return (-side(L.INDEX_TIP, L.MIDDLE_TIP) * knuckleSide) / (a.palmSize || 1);
}

/** How far the thumb tip is above the index knuckle in the image, in palm sizes (thumbs up > 0). */
export function thumbRaise(a: HandAnalysis): number {
  return (imagePoint(a, L.INDEX_MCP).y - imagePoint(a, L.THUMB_TIP).y) / (a.palmSize || 1);
}

/** Average gap between neighbouring fingertips (index..pinky), in world palm sizes. */
export function fingerSpread(a: HandAnalysis): number {
  const tips = [L.INDEX_TIP, L.MIDDLE_TIP, L.RING_TIP, L.PINKY_TIP];
  let sum = 0;
  for (let i = 0; i < tips.length - 1; i++) sum += tipGapInPalms(a, tips[i], tips[i + 1]);
  return sum / (tips.length - 1);
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bounding box of all 21 landmarks in aspect-corrected image units, optionally padded (palm sizes). */
export function handBox(a: HandAnalysis, padPalms = 0): Box {
  const pts = a.hand.landmarks.map((_, i) => imagePoint(a, i));
  const pad = padPalms * a.palmSize;
  return {
    minX: Math.min(...pts.map((p) => p.x)) - pad,
    minY: Math.min(...pts.map((p) => p.y)) - pad,
    maxX: Math.max(...pts.map((p) => p.x)) + pad,
    maxY: Math.max(...pts.map((p) => p.y)) + pad,
  };
}

function boxArea(b: Box): number {
  return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY);
}

/** Overlap of two hands' bounding boxes as a fraction of the smaller box (0..1). */
export function handOverlap(a: HandAnalysis, b: HandAnalysis): number {
  const ba = handBox(a), bb = handBox(b);
  const inter: Box = {
    minX: Math.max(ba.minX, bb.minX),
    minY: Math.max(ba.minY, bb.minY),
    maxX: Math.min(ba.maxX, bb.maxX),
    maxY: Math.min(ba.maxY, bb.maxY),
  };
  const smaller = Math.min(boxArea(ba), boxArea(bb));
  return smaller > 0 ? boxArea(inter) / smaller : 0;
}

/**
 * Fraction (0..1) of the 8 finger tips (index..pinky of both hands) that
 * reach into the OTHER hand's bounding box, i.e. fingers crossing over.
 */
export function tipsInOtherHand(a: HandAnalysis, b: HandAnalysis, padPalms = 0.1): number {
  const tips = [L.INDEX_TIP, L.MIDDLE_TIP, L.RING_TIP, L.PINKY_TIP];
  const inside = (p: Vec2, box: Box) => p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
  const boxA = handBox(a, padPalms), boxB = handBox(b, padPalms);
  let count = 0;
  for (const t of tips) {
    if (inside(imagePoint(a, t), boxB)) count++;
    if (inside(imagePoint(b, t), boxA)) count++;
  }
  return count / (tips.length * 2);
}

/** Distance between the two wrists, in palm sizes. */
export function wristDistanceInPalms(a: HandAnalysis, b: HandAnalysis): number {
  return crossHandDistanceInPalms(a, L.WRIST, b, L.WRIST);
}

/**
 * How far both wrists sit below the combined fingertip cluster, in palm
 * sizes (positive = wrists lower in the image, i.e. hands pointing up).
 */
export function wristsBelowFingers(a: HandAnalysis, b: HandAnalysis): number {
  const tipY = (a.tipCenter.y + b.tipCenter.y) / 2;
  const wristY = (imagePoint(a, L.WRIST).y + imagePoint(b, L.WRIST).y) / 2;
  return (wristY - tipY) / ((a.palmSize + b.palmSize) / 2 || 1);
}

/** Height / width of the box around both hands (> 1 = taller than wide). */
export function pairAspect(a: HandAnalysis, b: HandAnalysis): number {
  const ba = handBox(a), bb = handBox(b);
  const w = Math.max(ba.maxX, bb.maxX) - Math.min(ba.minX, bb.minX);
  const h = Math.max(ba.maxY, bb.maxY) - Math.min(ba.minY, bb.minY);
  return w > 0 ? h / w : 0;
}
