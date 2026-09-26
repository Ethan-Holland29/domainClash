import { isDomain, holdMs } from "../combat/MoveCatalog";
import { GameConfig } from "../config/GameConfig";
import type { TrackedHand } from "./HandTypes";
import { evaluateGestures } from "./GestureDefinitions";
import { GestureId, GesturePhase, type GestureEval, type GestureListener, type GestureState } from "./GestureTypes";

/** A confirmed pose remains latched until a deliberate release, even after cooldown. */
export class GestureRecognizer {
  private listeners = new Set<GestureListener>();
  private candidate: GestureId | null = null;
  private confirmed: GestureId | null = null;
  private latched: GestureId | null = null;
  private lastConfirmedAt = -Infinity;
  private heldMs = 0;
  private frames = 0;
  private releaseMs = 0;
  private score = 0;
  private phase: GesturePhase = GesturePhase.idle;
  private evals: GestureEval[] = [];
  private readonly evaluate: typeof evaluateGestures;

  constructor(evaluate = evaluateGestures) { this.evaluate = evaluate; }

  onConfirmed(listener: GestureListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset(): void {
    this.candidate = this.confirmed = this.latched = null;
    this.lastConfirmedAt = -Infinity;
    this.heldMs = this.frames = this.releaseMs = this.score = 0;
    this.phase = GesturePhase.idle;
    this.evals = [];
  }

  suspend():void {
    this.candidate=null;this.heldMs=0;this.frames=0;this.score=0;this.evals=[];
    this.releaseMs=0;this.phase=this.latched?GesturePhase.cooldown:GesturePhase.idle;
  }

  update(hands: TrackedHand[], dtMs: number, nowMs: number): GestureState {
    this.evals = this.evaluate(hands);
    const passed = this.evals.filter(e => e.passed && e.score >= GameConfig.gestures.minScore);
    // A valid two-hand sign must outrank its component single-hand poses.
    const winner = passed.filter(e=>isDomain(e.id)).sort((a,b)=>b.score-a.score)[0]
      ?? passed.sort((a, b) => b.score - a.score)[0];
    const dt = Math.max(0, Math.min(dtMs, 250));
    if (this.latched) {
      if (winner?.id === this.latched) this.releaseMs = 0;
      else this.releaseMs += dt;
      if (this.releaseMs < GameConfig.gestures.releaseMs) {
        this.phase = GesturePhase.cooldown;
        return this.snapshot();
      }
      this.latched = null;
      this.confirmed = null;
      this.releaseMs = 0;
      this.phase = GesturePhase.released;
    }
    if (!winner) {
      this.candidate = null;
      this.heldMs = this.frames = this.score = 0;
      if (this.phase !== GesturePhase.released) this.phase = GesturePhase.idle;
      return this.snapshot();
    }
    if (winner.id !== this.candidate) {
      this.candidate = winner.id;
      this.heldMs = 0;
      this.frames = 1;
      this.phase = GesturePhase.enter;
    } else {
      this.heldMs += dt;
      this.frames++;
      this.phase = GesturePhase.holding;
    }
    this.score = winner.score;
    if (this.heldMs >= holdMs(winner.id)
      && this.frames >= GameConfig.gestures.stabilityFrames
      && nowMs - this.lastConfirmedAt >= GameConfig.gestures.debounceMs) {
      this.latched = winner.id;
      this.confirm(winner.id, nowMs);
    }
    return this.snapshot();
  }

  state(): GestureState { return this.snapshot(); }

  debugEvals(): GestureEval[] { return this.evals; }

  inject(id: GestureId, nowMs: number): void {
    if (nowMs - this.lastConfirmedAt >= GameConfig.gestures.debounceMs) this.confirm(id, nowMs);
  }

  private confirm(id: GestureId, nowMs: number): void {
    this.confirmed = id;
    this.lastConfirmedAt = nowMs;
    this.phase = GesturePhase.confirmed;
    for (const listener of this.listeners) listener(id);
  }

  private snapshot(): GestureState {
    return {
      candidate: this.candidate, confirmed: this.confirmed, phase: this.phase,
      holdProgress: this.candidate ? Math.min(1, this.heldMs / holdMs(this.candidate)) : 0,
      score: this.score, lastConfirmedAt: this.lastConfirmedAt,
    };
  }
}

