import type { HandAnalysis } from './GestureTypes';
import { HandLandmarkIndex as L, type Landmark } from './HandTypes';

/**
 * Minimal training sample: what the model needs from a recorded dataset
 * sample. Kept structural so this module does not depend on the storage layer.
 */
export interface TrainingSample {
  label: string;
  aspectRatio: number;
  hands: { landmarks: Landmark[] }[];
  /** Capture time (epoch ms). Used to split samples into recording bursts for calibration. */
  timestamp?: number;
}

/** Temporal separation used to keep adjacent frames from one held pose out of spread calibration. */
const BURST_GAP_MS = 2000;
/** At most this many samples per label are used for calibration (keeps training fast). */
const CALIBRATION_SAMPLE_LIMIT = 300;

export interface KnnResult {
  /** Fraction (0..1) of the k nearest recorded samples that carry the label. */
  votes: number;
  /** Distance to the closest recorded sample of the label (RMS, in palm sizes). */
  nearest: number;
  /** How many neighbours were compared (k, or fewer if the dataset is small). */
  neighbours: number;
}

interface Entry {
  label: string;
  timestamp: number;
  /** One normalized shape vector per hand, ordered left-to-right on screen. */
  hands: number[][];
  /** Offset between the two wrists in palm sizes (two-hand samples only). */
  offset: [number, number] | null;
}

/**
 * k-nearest-neighbour matcher over recorded samples.
 *
 * Each hand becomes 42 numbers: its 21 landmarks relative to its own wrist,
 * divided by its palm size and rotated upright (so position in the frame,
 * distance from the camera, hand size and hand tilt do not matter). Fingertips are weighted up, since
 * they carry most of the difference between signs while the palm points
 * look alike in every pose. Two-hand samples also keep the
 * wrist-to-wrist offset, so "hands pressed together" differs from "hands
 * apart". Distance is RMS per coordinate, in palm sizes; the two hands are
 * compared in both orders because crossing/overlapping hands can swap sides.
 */
export class GestureKnnModel {
  readonly k: number;
  private entries: Entry[] = [];
  private counts = new Map<string, number>();
  /** Per label: how many samples had 1 hand vs 2 hands. */
  private handCounts = new Map<string, [number, number]>();
  /** Per label: typical distance between separate attempts of the same sign. */
  private spreads = new Map<string, number>();

  constructor(k = 7) {
    this.k = k;
  }

  train(samples: TrainingSample[]): void {
    this.entries = [];
    this.counts.clear();
    this.handCounts.clear();
    this.spreads.clear();
    for (const s of samples) {
      const hands = s.hands.map((h) => h.landmarks);
      const entry = toEntry(s.label, hands, s.aspectRatio, s.timestamp ?? 0);
      if (!entry) continue;
      this.entries.push(entry);
      this.counts.set(s.label, (this.counts.get(s.label) ?? 0) + 1);
      const hc = this.handCounts.get(s.label) ?? [0, 0];
      hc[entry.hands.length - 1]++;
      this.handCounts.set(s.label, hc);
    }
    for (const label of this.counts.keys()) this.spreads.set(label, this.calibrate(label));
  }

  /**
   * How different separate attempts of this sign are, in the same units as
   * KnnResult.nearest: for each sample, the distance to the closest sample of
   * the same label from a DIFFERENT recording burst (consecutive frames of one
   * burst are near-identical, so they would understate it). Returns the 90th
   * percentile, i.e. how far a genuine new attempt can land. 0 if unknown
   * (e.g. only one burst recorded).
   */
  private calibrate(label: string): number {
    const hands = this.handsFor(label);
    let own = this.entries.filter((e) => e.label === label && e.hands.length === hands);
    if (own.length > CALIBRATION_SAMPLE_LIMIT) {
      const step = own.length / CALIBRATION_SAMPLE_LIMIT;
      own = Array.from({ length: CALIBRATION_SAMPLE_LIMIT }, (_, i) => own[Math.floor(i * step)]);
    }
    const nearestOther = own.map((e) => {
      let best = Infinity;
      // A long continuous recording may never pause for two seconds. Compare
      // frames from separated time windows anyway; otherwise a large trusted
      // dataset can have a zero measured spread and reject its own sign.
      for (const o of own) if (Math.abs(o.timestamp - e.timestamp) >= BURST_GAP_MS) best = Math.min(best, distance(e, o));
      return best;
    });
    nearestOther.sort((a, b) => a - b);
    return nearestOther[Math.floor(nearestOther.length * 0.9)] ?? 0;
  }

  /** Typical distance between separate attempts of this sign (0 if unknown). */
  spreadFor(label: string): number {
    return this.spreads.get(label) ?? 0;
  }

  countFor(label: string): number {
    return this.counts.get(label) ?? 0;
  }

  /** Number of hands (1 or 2) most of this label's samples were recorded with. */
  handsFor(label: string): 1 | 2 {
    const [one, two] = this.handCounts.get(label) ?? [0, 0];
    return two >= one ? 2 : 1;
  }

  /** Compares the live hands with every recorded sample that has the same number of hands. */
  classify(label: string, hands: HandAnalysis[]): KnnResult {
    const query = toEntry('', hands.map((h) => h.hand.landmarks), hands[0]?.aspectRatio ?? 1, 0);
    if (!query) return { votes: 0, nearest: Infinity, neighbours: 0 };

    const scored: { label: string; d: number }[] = [];
    for (const e of this.entries) {
      if (e.hands.length !== query.hands.length) continue;
      scored.push({ label: e.label, d: distance(query, e) });
    }
    scored.sort((a, b) => a.d - b.d);
    const top = scored.slice(0, this.k);
    const nearest = scored.find((s) => s.label === label)?.d ?? Infinity;
    const votes = top.length ? top.filter((s) => s.label === label).length / top.length : 0;
    return { votes, nearest, neighbours: top.length };
  }
}

/** Extra weight for fingertip landmarks in the shape vector. */
const TIP_WEIGHT: Record<number, number> = {
  [L.THUMB_TIP]: 3,
  [L.INDEX_TIP]: 3,
  [L.MIDDLE_TIP]: 3,
  [L.RING_TIP]: 3,
  [L.PINKY_TIP]: 3,
};

function toEntry(label: string, hands: Landmark[][], aspectRatio: number, timestamp: number): Entry | null {
  if (hands.length === 0 || hands.length > 2 || hands.some((h) => h.length !== 21)) return null;
  const pts = hands
    .map((h) => h.map((p) => ({ x: p.x * aspectRatio, y: p.y })))
    .sort((a, b) => a[L.WRIST].x - b[L.WRIST].x);
  const palm = (h: { x: number; y: number }[]) =>
    Math.hypot(h[L.MIDDLE_MCP].x - h[L.WRIST].x, h[L.MIDDLE_MCP].y - h[L.WRIST].y) || 1;
  const shape = (h: { x: number; y: number }[]) => {
    const w = h[L.WRIST];
    const s = palm(h);
    // Rotate so wrist -> middle knuckle points straight up: tilting the hand
    // does not change its shape vector.
    const angle = Math.atan2(h[L.MIDDLE_MCP].x - w.x, -(h[L.MIDDLE_MCP].y - w.y));
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return h.flatMap((p, i) => {
      const k = TIP_WEIGHT[i] ?? 1;
      const dx = (p.x - w.x) / s, dy = (p.y - w.y) / s;
      return [(dx * cos + dy * sin) * k, (-dx * sin + dy * cos) * k];
    });
  };
  let offset: [number, number] | null = null;
  if (pts.length === 2) {
    const avg = (palm(pts[0]) + palm(pts[1])) / 2;
    offset = [(pts[1][L.WRIST].x - pts[0][L.WRIST].x) / avg, (pts[1][L.WRIST].y - pts[0][L.WRIST].y) / avg];
  }
  return { label, timestamp, hands: pts.map(shape), offset };
}

function sqDist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
}

function distance(q: Entry, e: Entry): number {
  if (q.hands.length === 1) return Math.sqrt(sqDist(q.hands[0], e.hands[0]) / q.hands[0].length);
  const n = q.hands[0].length * 2 + 2;
  const [qo, eo] = [q.offset!, e.offset!];
  const same = sqDist(q.hands[0], e.hands[0]) + sqDist(q.hands[1], e.hands[1]) + sqDist(qo, eo);
  const swapped = sqDist(q.hands[0], e.hands[1]) + sqDist(q.hands[1], e.hands[0]) + sqDist([-qo[0], -qo[1]], eo);
  return Math.sqrt(Math.min(same, swapped) / n);
}
