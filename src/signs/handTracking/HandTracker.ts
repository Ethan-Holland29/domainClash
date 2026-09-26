import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { Handedness, HandFrame, HandTrackerOptions, TrackedHand } from './HandTypes';

export const DEFAULT_HAND_TRACKER_OPTIONS: HandTrackerOptions = {
  wasmPath: '/mediapipe/wasm',
  modelPath: '/mediapipe/models/hand_landmarker.task',
  numHands: 2,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  mirrored: true,
  invertHandedness: false,
};

/** Wraps MediaPipe Hand Landmarker and converts its output to display-space HandFrames. */
export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private readonly options: HandTrackerOptions;
  private lastTimestampMs = -1;
  private _delegate: 'GPU' | 'CPU' | null = null;

  constructor(options: Partial<HandTrackerOptions> = {}) {
    this.options = { ...DEFAULT_HAND_TRACKER_OPTIONS, ...options };
  }

  get isReady(): boolean {
    return this.landmarker !== null;
  }

  /** Which MediaPipe delegate ended up being used. */
  get delegate(): 'GPU' | 'CPU' | null {
    return this._delegate;
  }

  async init(): Promise<void> {
    if (this.landmarker) return;
    const fileset = await FilesetResolver.forVisionTasks(this.options.wasmPath);
    const create = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: this.options.modelPath, delegate },
        runningMode: 'VIDEO',
        numHands: this.options.numHands,
        minHandDetectionConfidence: this.options.minHandDetectionConfidence,
        minHandPresenceConfidence: this.options.minHandPresenceConfidence,
        minTrackingConfidence: this.options.minTrackingConfidence,
      });

    try {
      this.landmarker = await create('GPU');
      this._delegate = 'GPU';
    } catch (err) {
      console.warn('HandTracker: GPU delegate unavailable, falling back to CPU', err);
      this.landmarker = await create('CPU');
      this._delegate = 'CPU';
    }
  }

  /**
   * Runs detection on the current video frame. Returns null if the tracker
   * is not ready or the timestamp did not advance (MediaPipe requires
   * strictly increasing timestamps in VIDEO mode).
   */
  detect(video: HTMLVideoElement, timestampMs: number): HandFrame | null {
    if (!this.landmarker || timestampMs <= this.lastTimestampMs) return null;
    this.lastTimestampMs = timestampMs;
    const result = this.landmarker.detectForVideo(video, timestampMs);
    const aspectRatio = video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 1;
    return { hands: this.toTrackedHands(result), timestampMs, aspectRatio };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this._delegate = null;
  }

  private toTrackedHands(result: HandLandmarkerResult): TrackedHand[] {
    const { mirrored, invertHandedness } = this.options;
    return result.landmarks.map((points, i) => {
      const category = result.handedness[i]?.[0];
      return {
        landmarks: points.map((p) => ({ x: mirrored ? 1 - p.x : p.x, y: p.y, z: p.z })),
        worldLandmarks: (result.worldLandmarks[i] ?? []).map((p) => ({ x: mirrored ? -p.x : p.x, y: p.y, z: p.z })),
        handedness: resolveHandedness(category?.categoryName, invertHandedness),
        handednessScore: category?.score ?? 0,
      };
    });
  }
}

function resolveHandedness(label: string | undefined, invert: boolean): Handedness {
  if (label !== 'Left' && label !== 'Right') return 'Unknown';
  if (!invert) return label;
  return label === 'Left' ? 'Right' : 'Left';
}
