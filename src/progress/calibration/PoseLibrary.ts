import type { TrackedHand } from '../handTracking/HandTypes';
import { ALL_GESTURES, type GestureType, type GestureEvaluation } from '../handTracking/GestureTypes';
import { canonicalRecordingLabel, evaluateMain, samplesFromPoses, signDefinition } from '../handTracking/MainSigns';
import { LEARNED_MODEL, SIGN_TUNING } from '../../signs/handTracking/GestureDefinitions';
import type { TrainingSample } from '../../signs/handTracking/GestureKnnModel';

export type Pose = number[][];
export type Library = Partial<Record<GestureType, Pose[]>>;
const KEY = 'domainclash.poses.v1';
export const MAX_POSES_PER_SIGN = 250;
export const MATCH_LIMIT = 0.19;

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
  private imported:TrainingSample[]=[];
  data: Library = {};
  warning = '';
  constructor() {
    try { const raw = localStorage.getItem(KEY); if (raw) this.data = validate(JSON.parse(raw)); }
    catch { this.warning = 'Saved signs could not be loaded. Record them again or import a backup.'; }
    this.retrain();
  }
  setImportedSamples(samples:TrainingSample[]):void{this.imported=samples.map(sample=>({...sample,label:canonicalRecordingLabel(sample.label)}));this.retrain();}
  private retrain():void {
    LEARNED_MODEL.train([...this.imported,...Object.entries(this.data).flatMap(([id,poses])=>samplesFromPoses(id as GestureType,poses!))]);
  }
  available(gesture:GestureType):boolean{const d=signDefinition(gesture);return !d.taughtOnly||LEARNED_MODEL.countFor(d.datasetLabel)>=SIGN_TUNING.learned.minSamples;}
  replace(data: Library): void {
    const valid = validate(data);
    localStorage.setItem(KEY, JSON.stringify(valid));
    this.data = valid;
    this.retrain();
  }
  /** Removes one gesture's pose recordings while leaving every other gesture untouched. */
  deleteGesture(gesture:GestureType):number{
    const deleted=this.data[gesture]?.length??0;
    if(!deleted)return 0;
    const next={...this.data};
    delete next[gesture];
    this.replace(next);
    return deleted;
  }
  /**
   * Merges a pose-library backup without replacing anything: poses already
   * saved are skipped, new ones are appended up to MAX_POSES_PER_SIGN.
   * Throws (and changes nothing) if the backup is not a valid pose library.
   */
  merge(data: unknown): { added: number; duplicates: number; overLimit: number } {
    const incoming = validate(data);
    const next: Library = { ...this.data };
    let added = 0, duplicates = 0, overLimit = 0;
    for (const [gesture, poses] of Object.entries(incoming) as [GestureType, Pose[]][]) {
      const existing = [...(next[gesture] ?? [])];
      const seen = new Set(existing.map(p => JSON.stringify(p)));
      for (const pose of poses) {
        const key = JSON.stringify(pose);
        if (seen.has(key)) { duplicates++; continue; }
        if (existing.length >= MAX_POSES_PER_SIGN) { overLimit++; continue; }
        existing.push(pose); seen.add(key); added++;
      }
      if (existing.length) next[gesture] = existing;
    }
    if (added) this.replace(next);
    return { added, duplicates, overLimit };
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
    return evaluateMain(hands,aspect,allowed);
  }
}
