/**
 * HandTracker
 *
 * Wraps MediaPipe's HandLandmarker so the rest of the app only ever
 * deals with our own HandTrackingResult type. Model loading and the
 * detection loop itself are filled in during Milestone 1 — this
 * scaffold just gets the dependency wired up and loadable.
 */

import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { HandTrackingResult, TrackedHand, Handedness } from "./HandTypes";

const WASM_BASE_URL =
  `${import.meta.env.BASE_URL}wasm`;
const MODEL_ASSET_URL =
  `${import.meta.env.BASE_URL}models/hand_landmarker.task`;

export class HandTracker {
  private landmarker: HandLandmarker | null = null;

  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);

    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_ASSET_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
  }

  get isReady(): boolean {
    return this.landmarker !== null;
  }

  /**
   * Detects hands in a single video frame and maps MediaPipe's result
   * shape into our own HandTrackingResult type.
   */
  detectForVideo(video: HTMLVideoElement, timestampMs: number): HandTrackingResult {
    if (!this.landmarker) {
      throw new Error("HandTracker.initialize() must resolve before detecting.");
    }

    const raw: HandLandmarkerResult = this.landmarker.detectForVideo(video, timestampMs);

    const hands: TrackedHand[] = raw.landmarks.map((landmarks, i) => {
      const handednessCandidates = raw.handednesses[i] ?? [];
      const top = handednessCandidates[0];

      return {
        worldLandmarks: raw.worldLandmarks[i]?.map(lm => ({x:lm.x,y:lm.y,z:lm.z})) ?? [],
        landmarks: landmarks.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })),
        handedness: (top?.categoryName as Handedness) ?? "Right",
        handednessScore: top?.score ?? 0,
      };
    });

    return { hands, timestampMs };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}

