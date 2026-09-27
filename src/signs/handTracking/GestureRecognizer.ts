import { GESTURE_DEFINITIONS } from './GestureDefinitions';
import type {
  GameAction,
  GestureDefinition,
  GestureEvent,
  GestureEvaluation,
  GestureEventType,
  GesturePhase,
  GestureRecognizerConfig,
  GestureSnapshot,
  HandAnalysis,
} from './GestureTypes';
import { DEFAULT_HAND_FILTER_CONFIG, filterHands, type HandFilterConfig } from './HandFilter';
import { analyzeFrame } from './HandGeometry';
import type { HandFrame } from './HandTypes';

export const DEFAULT_GESTURE_CONFIG: GestureRecognizerConfig = {
  holdMs: 500,
  enterThreshold: 0.7,
  releaseThreshold: 0.45,
  ambiguityMargin: 0.15,
  scoreSmoothingMs: 80,
  maxHandSpeed: 5,
  releaseGraceMs: 250,
  debounceMs: 400,
};

/** Frames further apart than this are not used for speed/smoothing (e.g. after a stall). */
const MAX_FRAME_GAP_MS = 250;

interface ActiveGesture {
  def: GestureDefinition;
  phase: Exclude<GesturePhase, 'idle'>;
  startedMs: number;
  lastSeenMs: number;
  score: number;
}

/**
 * Turns per-frame hand data into discrete gesture events.
 *
 * Per frame: unreliable hands are filtered out (HandFilter), every gesture is
 * scored, scores are smoothed over time, and fast hand movement blocks all
 * gestures (poses passed through mid-transition must not count).
 *
 * State machine (one active gesture at a time):
 *   idle --score >= enterThreshold, unambiguous--> candidate
 *   candidate --held holdMs and still >= enterThreshold--> confirmed (fires once)
 *   An active gesture survives while its score >= releaseThreshold.
 *   candidate --lost > releaseGraceMs--> idle ("cancelled")
 *   confirmed --lost > releaseGraceMs--> idle ("released"), then that
 *   gesture is debounced for debounceMs before it can start again.
 *
 * All timing uses frame timestamps, so it is frame-rate independent.
 */
export class GestureRecognizer {
  readonly config: GestureRecognizerConfig;
  private definitions: GestureDefinition[];
  private readonly filterConfig: HandFilterConfig;
  private readonly listeners = new Set<(event: GestureEvent) => void>();

  private active: ActiveGesture | null = null;
  /** Keyed by gesture id. */
  private readonly debounceUntil = new Map<string, number>();
  /** Gestures that may not start again until their score has dropped (the pose was let go). */
  private readonly mustRelease = new Set<string>();
  private lastTimestampMs = 0;
  private scores = new Map<string, number>();
  private evaluations = new Map<string, GestureEvaluation>();
  private hands: HandAnalysis[] = [];
  private droppedHands: string[] = [];
  private handSpeed = 0;
  private moving = false;
  private prevHands: HandAnalysis[] = [];
  private prevTimestampMs: number | null = null;

  constructor(
    config: Partial<GestureRecognizerConfig> = {},
    definitions: GestureDefinition[] = GESTURE_DEFINITIONS,
    filterConfig: HandFilterConfig = DEFAULT_HAND_FILTER_CONFIG,
  ) {
    this.config = { ...DEFAULT_GESTURE_CONFIG, ...config };
    this.definitions = definitions;
    this.filterConfig = filterConfig;
  }

  /** Subscribe to gesture events. Returns an unsubscribe function. */
  onEvent(listener: (event: GestureEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Convenience: called once per confirmed gesture with the game action and which sign fired. */
  onAction(listener: (action: GameAction, gesture: GestureDefinition) => void): () => void {
    return this.onEvent((e) => {
      if (e.type === 'confirmed') listener(e.action, e.gesture);
    });
  }

  update(frame: HandFrame): void {
    const now = frame.timestampMs;
    const dt = this.prevTimestampMs === null ? Infinity : now - this.prevTimestampMs;
    this.prevTimestampMs = now;
    this.lastTimestampMs = now;

    const analyzed = analyzeFrame(frame);
    const filtered = filterHands(analyzed, frame.aspectRatio, this.filterConfig);
    this.hands = filtered.hands;
    this.droppedHands = filtered.dropped;
    this.handSpeed = dt <= MAX_FRAME_GAP_MS ? maxHandSpeed(this.prevHands, this.hands, dt) : 0;
    this.prevHands = this.hands;
    this.moving = this.handSpeed > this.config.maxHandSpeed;

    // Exponential smoothing with a time constant, so it behaves the same at any FPS.
    const alpha = dt <= MAX_FRAME_GAP_MS ? 1 - Math.exp(-dt / this.config.scoreSmoothingMs) : 1;
    const ctx = { hands: this.hands, allHands: analyzed };
    for (const def of this.definitions) {
      const result = def.evaluate(ctx);
      this.evaluations.set(def.id, result);
      const raw = this.moving ? 0 : result.score;
      const prev = this.scores.get(def.id) ?? 0;
      this.scores.set(def.id, prev + (raw - prev) * alpha);
    }

    // Raw (unsmoothed) score: right after a reset the smoothed score restarts
    // from 0 and would look "released" even while the pose is still held.
    // Only gestures in the active set are judged: an inactive one has no score
    // this frame, which says nothing about whether the player let go.
    for (const id of this.mustRelease) {
      const evaluation = this.evaluations.get(id);
      if (!evaluation) continue;
      const raw = this.moving ? 0 : evaluation.score;
      if (raw < this.config.releaseThreshold) this.mustRelease.delete(id);
    }

    const active = this.active;
    if (active) {
      // The active gesture stays alive while its own score stays above the
      // (lower) release threshold, even if another gesture briefly scores higher.
      const activeScore = this.score(active.def);
      if (activeScore >= this.config.releaseThreshold) {
        active.lastSeenMs = now;
        active.score = activeScore;
      } else if (now - active.lastSeenMs > this.config.releaseGraceMs) {
        this.endActive(now);
      }
    }

    if (!this.active) {
      const best = this.pickCandidate(now);
      if (best) {
        this.active = { def: best.def, phase: 'candidate', startedMs: now, lastSeenMs: now, score: best.score };
        this.emit('enter', best.def, now, best.score);
      }
    }

    // Confirm only once held long enough AND the pose is still clearly matching.
    const current = this.active;
    if (
      current?.phase === 'candidate' &&
      now - current.startedMs >= this.holdMs(current.def) &&
      this.score(current.def) >= this.config.enterThreshold
    ) {
      current.phase = 'confirmed';
      this.emit('confirmed', current.def, now, current.score);
    }
  }

  /** Best gesture above enterThreshold that clearly beats the runner-up. */
  private pickCandidate(now: number): { def: GestureDefinition; score: number } | null {
    const ranked = this.definitions
      .map((def) => ({ def, score: this.score(def) }))
      .sort((a, b) => b.score - a.score);
    const [best, second] = ranked;
    if (!best || best.score < this.config.enterThreshold || this.isDebounced(best.def, now)) return null;
    if (this.mustRelease.has(best.def.id)) return null;
    if (second && best.score - second.score < this.config.ambiguityMargin) return null;
    return best;
  }

  /**
   * Blocks a gesture from firing again until the player lets go of the pose
   * (its score drops below releaseThreshold). Survives reset/setDefinitions.
   */
  requireRelease(gestureId: string): void {
    this.mustRelease.add(gestureId);
  }

  /** Swaps the active gesture set (e.g. on character select) and clears all state. */
  setDefinitions(definitions: GestureDefinition[]): void {
    this.definitions = definitions;
    this.reset();
  }

  /** Clears all state, e.g. when the camera stops. Emits no events. */
  reset(): void {
    this.active = null;
    this.debounceUntil.clear();
    this.scores.clear();
    this.evaluations.clear();
    this.hands = [];
    this.droppedHands = [];
    this.handSpeed = 0;
    this.moving = false;
    this.prevHands = [];
    this.prevTimestampMs = null;
  }

  snapshot(): GestureSnapshot {
    const a = this.active;
    const now = this.lastTimestampMs;
    return {
      phase: a?.phase ?? 'idle',
      active: a?.def ?? null,
      holdProgress: a ? (a.phase === 'confirmed' ? 1 : Math.min(1, (now - a.startedMs) / this.holdMs(a.def))) : 0,
      score: a?.score ?? 0,
      gestures: this.definitions.map((definition) => ({
        definition,
        score: this.score(definition),
        evaluation: this.evaluations.get(definition.id) ?? { score: 0, checks: [] },
        cooldownMs: Math.max(0, (this.debounceUntil.get(definition.id) ?? 0) - now),
      })),
      hands: this.hands,
      droppedHands: this.droppedHands,
      handSpeed: this.handSpeed,
      moving: this.moving,
    };
  }

  private endActive(now: number): void {
    const a = this.active!;
    this.active = null;
    if (a.phase === 'confirmed') {
      this.debounceUntil.set(a.def.id, now + this.config.debounceMs);
      this.emit('released', a.def, now, a.score);
    } else {
      this.emit('cancelled', a.def, now, a.score);
    }
  }

  private isDebounced(def: GestureDefinition, now: number): boolean {
    return now < (this.debounceUntil.get(def.id) ?? 0);
  }

  private score(def: GestureDefinition): number {
    return this.scores.get(def.id) ?? 0;
  }

  private holdMs(def: GestureDefinition): number {
    return def.holdMs ?? this.config.holdMs;
  }

  private emit(type: GestureEventType, gesture: GestureDefinition, timestampMs: number, score: number): void {
    const event: GestureEvent = { type, action: gesture.action, gesture, timestampMs, score };
    for (const listener of this.listeners) listener(event);
  }
}

/**
 * Fastest movement of any hand since the previous frame, in palm sizes per
 * second. Each hand is matched to the nearest hand of the previous frame;
 * hands that just appeared count as still.
 */
function maxHandSpeed(prev: HandAnalysis[], current: HandAnalysis[], dtMs: number): number {
  if (dtMs <= 0 || prev.length === 0) return 0;
  let max = 0;
  for (const h of current) {
    let nearest = Infinity;
    for (const p of prev) {
      nearest = Math.min(nearest, Math.hypot(h.palmCenter.x - p.palmCenter.x, h.palmCenter.y - p.palmCenter.y));
    }
    if (h.palmSize > 0 && Number.isFinite(nearest)) max = Math.max(max, nearest / h.palmSize / (dtMs / 1000));
  }
  return max;
}
