/**
 * Gesture dataset schema. This is a storage/interchange contract, so it is
 * defined with plain types here rather than reusing tracker types: changing
 * the tracker must not silently change stored or exported data.
 *
 * Bump DATASET_SCHEMA_VERSION when the sample shape changes, and add a
 * migration in GestureDatasetImportExport.
 */
export const DATASET_SCHEMA_VERSION = 1;

/** Identifies an exported file as a DomainClash dataset. */
export const DATASET_FORMAT = 'domainclash-gesture-dataset';

export const DATASET_FILENAME = 'domainclash-gesture-dataset.json';

/**
 * Labels that are not hand signs. The recorder offers these in addition to
 * every sign's datasetLabel (supplied by the app from the gesture list), so
 * new signs appear automatically. Every other recordable label belongs to a
 * real sign, so recorded samples are always used. Imported data may contain
 * unknown labels; those are kept, counted, and act as counter-examples.
 */
export const EXTRA_DATASET_LABELS = ['NONE'] as const;

export type GestureLabel = string;

export interface SampleLandmark {
  x: number;
  y: number;
  z: number;
}

export interface SampleHand {
  handedness: 'Left' | 'Right' | 'Unknown';
  handednessScore: number;
  /** 21 normalized image landmarks (display space, mirrored like the on-screen view). */
  landmarks: SampleLandmark[];
  /** 21 metric world landmarks (metres, hand-centred), when available. */
  worldLandmarks: SampleLandmark[];
}

/** Derived per-hand features, as used by the rule-based classifier at capture time. */
export interface SampleHandFeatures {
  handedness: 'Left' | 'Right' | 'Unknown';
  /** Total bend per finger in degrees (0 = straight). */
  fingerBendDeg: { thumb: number; index: number; middle: number; ring: number; pinky: number };
  palmNormal: SampleLandmark;
  /** Palm size in aspect-corrected image units. */
  palmSize: number;
}

/** Derived two-hand features (first two hands), in palm sizes / fractions. */
export interface SamplePairFeatures {
  palmDistance: number;
  wristDistance: number;
  /** Bounding-box overlap as a fraction of the smaller hand. */
  overlap: number;
  /** Fraction of the 8 fingertips inside the other hand's box. */
  tipsInOtherHand: number;
}

export interface SampleFeatures {
  hands: SampleHandFeatures[];
  pair: SamplePairFeatures | null;
  /** Score (0..1) of every rule-based sign at capture time, keyed by sign id. */
  signScores: Record<string, number>;
}

export interface GestureSample {
  /** Unique id; used to skip duplicates when merging. */
  id: string;
  schemaVersion: number;
  label: GestureLabel;
  /** Capture time, epoch milliseconds. */
  timestamp: number;
  /** Video width / height when captured (normalized x must be scaled by this for true proportions). */
  aspectRatio: number;
  hands: SampleHand[];
  features: SampleFeatures;
}

/** Shape of an exported dataset file. */
export interface GestureDatasetFile {
  format: typeof DATASET_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  labels: GestureLabel[];
  counts: Record<GestureLabel, number>;
  samples: GestureSample[];
}

export type ImportMode = 'replace' | 'merge';
