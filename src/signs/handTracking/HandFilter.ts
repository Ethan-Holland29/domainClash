import type { HandAnalysis } from './GestureTypes';

export interface HandFilterConfig {
  /**
   * Hands with any landmark closer than this to the frame edge (normalized
   * 0..1) are ignored: MediaPipe guesses the missing part, and the guessed
   * fingers produce false gestures.
   */
  edgeMargin: number;
  /**
   * Ignore hands whose Left/Right confidence is below this (a coin-flip
   * label usually means a bad detection). Kept low on purpose: edge-on and
   * interlocked hands, used by the two-hand signs, naturally score lower.
   */
  minHandConfidence: number;
  /**
   * Two detections with the SAME handedness whose landmarks are on average
   * closer than this (in palm sizes) are one physical hand detected twice;
   * the weaker one is dropped. Handedness must match because a real
   * left+right pair pressed palm-to-palm also has overlapping landmarks.
   */
  duplicateDistancePalms: number;
}

export const DEFAULT_HAND_FILTER_CONFIG: HandFilterConfig = {
  edgeMargin: 0.02,
  minHandConfidence: 0.55,
  duplicateDistancePalms: 0.6,
};

export interface FilteredHands {
  /** Hands trusted for gesture recognition. */
  hands: HandAnalysis[];
  /** Why other hands were ignored, for the debug view. */
  dropped: string[];
}

export function filterHands(
  hands: HandAnalysis[],
  aspectRatio: number,
  config: HandFilterConfig = DEFAULT_HAND_FILTER_CONFIG,
): FilteredHands {
  const dropped: string[] = [];
  const kept: HandAnalysis[] = [];
  const m = config.edgeMargin;

  for (const h of hands) {
    const name = h.hand.handedness;
    if (h.hand.landmarks.some((p) => p.x < m || p.x > 1 - m || p.y < m || p.y > 1 - m)) {
      dropped.push(`${name}: partly out of frame`);
    } else if (h.hand.handednessScore < config.minHandConfidence) {
      dropped.push(`${name}: low confidence ${(h.hand.handednessScore * 100).toFixed(0)}%`);
    } else {
      kept.push(h);
    }
  }

  // Most confident first, so a duplicate always drops the weaker detection.
  kept.sort((a, b) => b.hand.handednessScore - a.hand.handednessScore);
  const unique: HandAnalysis[] = [];
  for (const h of kept) {
    const dup = unique.find(
      (u) =>
        u.hand.handedness === h.hand.handedness &&
        meanLandmarkDistance(u, h, aspectRatio) < config.duplicateDistancePalms,
    );
    if (dup) dropped.push(`${h.hand.handedness}: duplicate of ${dup.hand.handedness}`);
    else unique.push(h);
  }
  return { hands: unique, dropped };
}

/** Mean distance between corresponding landmarks, in palm sizes. */
function meanLandmarkDistance(a: HandAnalysis, b: HandAnalysis, aspectRatio: number): number {
  const pa = a.hand.landmarks;
  const pb = b.hand.landmarks;
  let sum = 0;
  for (let i = 0; i < pa.length; i++) {
    sum += Math.hypot((pa[i].x - pb[i].x) * aspectRatio, pa[i].y - pb[i].y);
  }
  const palm = (a.palmSize + b.palmSize) / 2;
  return palm > 0 ? sum / pa.length / palm : Infinity;
}
