/**
 * GestureRecognizer
 *
 * Turns per-frame gesture evaluations into discrete, debounced events.
 * A gesture must be evaluated as "matched" continuously for its
 * configured hold duration before it fires as CONFIRMED. Once
 * confirmed, it enters a short cooldown/release state so holding the
 * pose doesn't fire the ability again every frame — the player must
 * visibly release (stop matching) before it can re-trigger.
 *
 * This module knows nothing about combat; it only emits gesture names.
 */

import type { TrackedHand } from "./HandTypes";
import { evaluateAllGestures } from "./GestureDefinitions";
import {
  DEFAULT_GESTURE_CONFIG,
  type GestureRecognitionState,
  type GestureType,
  type GestureEvaluation,
} from "./GestureTypes";

export type GestureEventType = "enter" | "confirmed" | "released";

export interface GestureEvent {
  type: GestureEventType;
  gesture: GestureType;
}

export type GestureListener = (event: GestureEvent) => void;

const RELEASE_COOLDOWN_MS = 400;
const MATCH_GRACE_MS = 150;

export class GestureRecognizer {
  private candidate: GestureType | null = null;
  private candidateSince = 0;
  private candidateHoldMs = 0;
  private mismatchSince: number | null = null;
  private lastUpdate = 0;
  private lastTwoHands = -Infinity;
  private confirmed: GestureType | null = null;
  private cooldownUntil = 0;
  private listeners: GestureListener[] = [];
  private lastState: GestureRecognitionState = {
    phase: "idle",
    candidateGesture: null,
    confirmedGesture: null,
    holdProgress: 0,
    debug: [],
  };

  private evaluate: (hands: TrackedHand[]) => GestureEvaluation[];
  constructor(evaluate: (hands: TrackedHand[]) => GestureEvaluation[] = evaluateAllGestures) { this.evaluate = evaluate; }

  onEvent(listener: GestureListener): void {
    this.listeners.push(listener);
  }

  private emit(event: GestureEvent): void {
    for (const l of this.listeners) l(event);
  }

  /** Call once per frame with the current tracked hands and a timestamp in ms. */
  update(hands: TrackedHand[], now: number): GestureRecognitionState {
    const delta = Math.max(0, now - this.lastUpdate);
    this.lastUpdate = now;
    const evaluations = this.evaluate(hands);
    if (hands.length === 2) this.lastTwoHands = now;
    // Do not turn a briefly occluded two-hand pose into a one-hand attack.
    if (hands.length === 1 && now - this.lastTwoHands < 650) {
      for (const evaluation of evaluations) evaluation.matched = false;
    }
    const matched = evaluations.find((e) => e.matched)?.gesture ?? null;

    // Hard reset if tracking is lost entirely.
    if (hands.length === 0) {
      this.resetToIdle();
      return this.buildState("idle", evaluations, 0);
    }

    const inCooldown = now < this.cooldownUntil;

    if (this.confirmed) {
      if (matched !== this.confirmed) {
        this.mismatchSince ??= now;
        if (now - this.mismatchSince >= MATCH_GRACE_MS) {
          this.emit({ type: "released", gesture: this.confirmed });
          this.confirmed = null;
          this.candidate = null;
          this.mismatchSince = null;
          this.cooldownUntil = now + RELEASE_COOLDOWN_MS;
          return this.buildState("cooldown", evaluations, 0);
        }
      } else this.mismatchSince = null;
      return this.buildState("confirmed", evaluations, 1);
    }

    if (inCooldown) {
      return this.buildState("cooldown", evaluations, 0);
    }

    if (!matched) {
      if (this.candidate) {
        this.mismatchSince ??= now;
        // Pause the timer; unmatched frames never count toward confirmation.
        this.candidateSince += delta;
        if (now - this.mismatchSince < MATCH_GRACE_MS) {
          const hold = this.candidateHoldMs;
          return this.buildState("candidate", evaluations, Math.max(0, Math.min((now - this.candidateSince) / hold, 1)));
        }
      }
      this.candidate = null;
      this.mismatchSince = null;
      return this.buildState("idle", evaluations, 0);
    }
    if (this.mismatchSince !== null) {
      if (now - this.mismatchSince >= MATCH_GRACE_MS) this.candidate = null;
      else this.candidateSince += delta;
      this.mismatchSince = null;
    }

    if (this.candidate !== matched) {
      this.candidate = matched;
      this.candidateSince = now;
      this.candidateHoldMs = DEFAULT_GESTURE_CONFIG[matched].holdMs;
      this.emit({ type: "enter", gesture: matched });
    }

    // If any accepted frame needs the slower route, keep the longer hold for
    // this whole candidate rather than letting threshold flicker confirm early.
    this.candidateHoldMs = Math.max(this.candidateHoldMs, evaluations.find(e => e.gesture === matched)?.requiredHoldMs ?? 0);
    const holdMs = this.candidateHoldMs;
    const elapsed = now - this.candidateSince;
    const progress = Math.min(elapsed / holdMs, 1);

    if (progress >= 1) {
      this.confirmed = matched;
      this.emit({ type: "confirmed", gesture: matched });
      return this.buildState("confirmed", evaluations, 1);
    }

    return this.buildState("candidate", evaluations, progress);
  }

  private resetToIdle(): void {
    this.mismatchSince = null;
    this.lastTwoHands = -Infinity;
    this.candidate = null;
    this.confirmed = null;
    this.cooldownUntil = 0;
  }

  private buildState(
    phase: GestureRecognitionState["phase"],
    debug: GestureRecognitionState["debug"],
    holdProgress: number,
  ): GestureRecognitionState {
    this.lastState = {
      phase,
      candidateGesture: this.candidate,
      confirmedGesture: this.confirmed,
      holdProgress,
      debug,
    };
    return this.lastState;
  }

  getState(): GestureRecognitionState {
    return this.lastState;
  }
}
