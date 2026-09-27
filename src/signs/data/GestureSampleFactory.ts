import { GESTURE_DEFINITIONS } from '../handTracking/GestureDefinitions';
import type { GestureDefinition } from '../handTracking/GestureTypes';
import {
  analyzeFrame,
  handOverlap,
  palmDistanceInPalms,
  tipsInOtherHand,
  wristDistanceInPalms,
} from '../handTracking/HandGeometry';
import type { HandFrame, Landmark } from '../handTracking/HandTypes';
import {
  DATASET_SCHEMA_VERSION,
  type GestureLabel,
  type GestureSample,
  type SampleLandmark,
} from './GestureDatasetTypes';

/** Builds a dataset sample from one tracked frame. */
export function createSample(
  label: GestureLabel,
  frame: HandFrame,
  definitions: GestureDefinition[] = GESTURE_DEFINITIONS,
): GestureSample {
  const analyzed = analyzeFrame(frame);
  const [a, b] = analyzed;
  const signScores: Record<string, number> = {};
  for (const def of definitions) signScores[def.id] = round(def.evaluate({ hands: analyzed, allHands: analyzed }).score);

  return {
    id: crypto.randomUUID(),
    schemaVersion: DATASET_SCHEMA_VERSION,
    label,
    timestamp: Date.now(),
    aspectRatio: round(frame.aspectRatio),
    hands: frame.hands.map((h) => ({
      handedness: h.handedness,
      handednessScore: round(h.handednessScore),
      landmarks: h.landmarks.map(point),
      worldLandmarks: h.worldLandmarks.map(point),
    })),
    features: {
      hands: analyzed.map((h) => ({
        handedness: h.hand.handedness,
        fingerBendDeg: {
          thumb: round(h.fingers.thumb.bendDeg),
          index: round(h.fingers.index.bendDeg),
          middle: round(h.fingers.middle.bendDeg),
          ring: round(h.fingers.ring.bendDeg),
          pinky: round(h.fingers.pinky.bendDeg),
        },
        palmNormal: point(h.palmNormal),
        palmSize: round(h.palmSize),
      })),
      pair:
        a && b
          ? {
              palmDistance: round(palmDistanceInPalms(a, b)),
              wristDistance: round(wristDistanceInPalms(a, b)),
              overlap: round(handOverlap(a, b)),
              tipsInOtherHand: round(tipsInOtherHand(a, b)),
            }
          : null,
      signScores,
    },
  };
}

/** 6 decimals is far below landmark noise and keeps exported files readable. */
function round(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

function point(p: Landmark): SampleLandmark {
  return { x: round(p.x), y: round(p.y), z: round(p.z) };
}
