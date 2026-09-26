import type { TrackedHand } from '../handTracking/HandTypes';
import {fallbackSigns} from '../integration/Signs';
import { ALL_GESTURES, type GestureType, type GestureEvaluation } from '../handTracking/GestureTypes';

export type Pose = number[][];
export type Library = Partial<Record<GestureType, Pose[]>>;
const KEY = 'domainclash.poses.v1';
export const MAX_POSES_PER_SIGN = 250;
export const MATCH_LIMIT = 0.19;
const MATCH_LIMITS: Partial<Record<GestureType, number>> = { BASIC_PUNCH: 0.23, MAHORAGA: 0.25, AMPLIFICATION_BLUE: 1.0 };

// Wrist-relative coordinates preserve finger shape and orientation. Palm scaling
// removes camera distance; wrist separation retains the two-hand relationship.
export function describe(hands: TrackedHand[], aspect = 4 / 3): Pose | null {
  if (!hands.length || hands.length > 2) return null;
  const sorted = [...hands].sort((a, b) => a.landmarks[0].x - b.landmarks[0].x);
  const scales = sorted.map(h => Math.hypot((h.landmarks[9].x - h.landmarks[0].x) * aspect, h.landmarks[9].y - h.landmarks[0].y));
  if (scales.some(s => s < 0.015)) return null;
  const mean = scales.reduce((a, b) => a + b, 0) / scales.length;
  return sorted.map((h, i) => {
    const wrist = h.landmarks[0];
    return [...h.landmarks.flatMap(p => [(p.x - wrist.x) * aspect / scales[i], (p.y - wrist.y) / scales[i], (p.z - wrist.z) * aspect / scales[i]]),
      (wrist.x - sorted[0].landmarks[0].x) * aspect / mean,
      (wrist.y - sorted[0].landmarks[0].y) / mean];
  });
}
export function distance(a: Pose, b: Pose): number {
  if (a.length !== b.length) return Infinity;
  const compare = (other: Pose) => Math.sqrt(a.reduce((sum, hand, i) => sum + hand.reduce((s, v, j) => {
    // Estimated depth is less reliable under occlusion; retain it at lower weight.
    const weight = j < 63 && j % 3 === 2 ? 0.25 : 1;
    return s + weight * (v - other[i][j]) ** 2;
  }, 0), 0) / (a.length * 49.25));
  const direct = compare(b);
  if (b.length === 1) {
    // Opposite hands have mirrored wrist-relative x coordinates. Keep y and
    // depth unchanged so finger shape and palm-facing direction still matter.
    const mirrored = [b[0].map((value, index) => index < 63 && index % 3 === 0 ? -value : value)];
    // Allow modest wrist tilt when switching hands, without ignoring pose shape.
    const variants = [b, mirrored].flatMap(pose => [-20, -10, 0, 10, 20].map(degrees => {
      const angle = degrees * Math.PI / 180;
      const hand = [...pose[0]];
      for (let i = 0; i < 63; i += 3) {
        hand[i] = pose[0][i] * Math.cos(angle) - pose[0][i + 1] * Math.sin(angle);
        hand[i + 1] = pose[0][i] * Math.sin(angle) + pose[0][i + 1] * Math.cos(angle);
      }
      return [hand];
    }));
    return Math.min(...variants.map(compare));
  }
  if (b.length !== 2) return direct;
  // When wrists cross, x-sorting swaps hand identities. Rebase their relative
  // wrist offsets as well as swapping the hand descriptors.
  const swapped = [
    [...b[1].slice(0, 63), 0, 0],
    [...b[0].slice(0, 63), -b[1][63], -b[1][64]],
  ];
  return Math.min(direct, compare(swapped));
}
export function validate(value: unknown): Library {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid sign library.');
  const result: Library = {};
  for (const [key, poses] of Object.entries(value)) {
    if (key === "DISMANTLE" || key === "DOMAIN_EXPANSION") continue; // Migrate older backups without losing other signs.
    if (!ALL_GESTURES.includes(key as GestureType) || !Array.isArray(poses) || !poses.length || poses.length > MAX_POSES_PER_SIGN) throw new Error('Invalid sign library.');
    for (const pose of poses) {
      if (!Array.isArray(pose) || ![1, 2].includes(pose.length) || !pose.every(h => Array.isArray(h) && h.length === 65 && h.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 100))) throw new Error('Invalid pose data.');
    }
    result[key as GestureType] = poses;
  }
  return result;
}
export class PoseLibrary {
  data: Library = {};
  warning = '';
  constructor() {
    try { const raw = localStorage.getItem(KEY); if (raw) this.data = validate(JSON.parse(raw)); }
    catch { this.warning = 'Saved signs could not be loaded. Record them again or import a backup.'; }
  }
  replace(data: Library): void {
    const valid = validate(data);
    localStorage.setItem(KEY, JSON.stringify(valid));
    this.data = valid;
  }
  addExample(gesture: GestureType, poses: Pose[]): void {
    if (!poses.length) throw new Error('Record an example first.');
    const existing = this.data[gesture] ?? [];
    if (existing.length + poses.length > MAX_POSES_PER_SIGN) {
      throw new Error('This sign has reached its sample limit. Export a backup, then replace its examples to start fresh.');
    }
    this.replace({ ...this.data, [gesture]: [...existing, ...poses] });
  }
  evaluate(hands: TrackedHand[], aspect: number, allowed: GestureType[] = ALL_GESTURES): GestureEvaluation[] {
    const pose = describe(hands, aspect);
    const ranked = allowed.map(gesture => ({ gesture, error: pose ? Math.min(...(this.data[gesture] ?? []).map(p => distance(pose, p))) : Infinity })).sort((a, b) => a.error - b.error);
    const learned = ranked.map((r, i) => {
      const limit = MATCH_LIMITS[r.gesture] ?? MATCH_LIMIT;
      const maximum = r.gesture === 'AMPLIFICATION_BLUE' ? limit : limit * 1.5;
      const gap = (ranked[1]?.error ?? Infinity) - r.error;
      const strict = i === 0 && r.error < limit && gap > 0.035;
      // A consistently best pose may be usable beyond the strict cutoff, but
      // only within a bounded distance and with clear separation from rivals.
      const stableBest = i === 0 && Number.isFinite(r.error) && r.error < maximum && gap > Math.max(0.02, r.error * 0.2);
      return {
        gesture: r.gesture,
        matched: strict || stableBest,
        requiredHoldMs: r.gesture === 'AMPLIFICATION_BLUE' || (!strict && stableBest) ? 1000 : undefined,
        debug: {
          error: Number.isFinite(r.error) ? r.error : null, limit,
          score: Math.max(0, 1 - r.error / maximum),
          checks: { recorded: !!this.data[r.gesture], closeToReference: r.error < limit,
            distinctFromOtherSigns: i === 0 && gap > 0.035,
            stableBestCandidate: !strict && stableBest },
        },
      };
    });
    const fallback = fallbackSigns(hands,aspect,allowed.filter(g=>!this.data[g]?.length));
    return [...learned.filter(r=>!!this.data[r.gesture]?.length),...fallback];
  }
}
