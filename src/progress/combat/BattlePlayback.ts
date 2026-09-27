import type { EffectCue } from '../rendering/CharacterEffects';
import type { BattleEvent, BattleState, Side } from '../../../shared/battle.mjs';

/** How long each line of battle text stays up (moves get longer for their effect). */
export const LINE_MS = 1000;
export const MOVE_LINE_MS = 1400;
/** Lines that announce an ability; the panels show them as a popup. */
export const CALLOUT_TYPES = new Set(['passive', 'black-flash', 'immune', 'adapt', 'domain-open', 'domain-clash', 'mahoraga']);

export interface BattleLine { serial: number; text: string; event: BattleEvent | null }

/**
 * Effect cue for a 'move' line, judging hit/miss from the lines that follow it.
 * `mySide` is the engine side shown as the local player (online seat 1 is side 1).
 */
export function effectCue(state: BattleState, event: BattleEvent, following: BattleEvent[], mySide: Side = 0): EffectCue {
  const rest: BattleEvent[] = [];
  for (const e of following) { if (e.type === 'move' || e.type === 'stunned' || e.type === 'domain-tick' || e.type === 'domain-miss') break; rest.push(e); }
  const side = event.side as Side;
  return {
    character: event.effect === 'MAHORAGA' ? 'megumi' : state.sides[side].id,
    action: event.effect ?? event.move ?? '',
    side: side === mySide ? 'player' : 'enemy',
    hit: !rest.some((e) => e.type === 'miss' || e.type === 'blocked'),
    blackFlash: rest.some((e) => e.type === 'black-flash'),
  };
}

/**
 * Plays a resolved turn's battle text one line at a time (solo and online),
 * with the health and cursed-energy bars following the text and an effect cue for every move.
 */
export class BattlePlayback {
  onEffect: (cue: EffectCue) => void = () => {};
  onEvent: (event: BattleEvent, state: BattleState) => void = () => {};
  /** The line currently shown. */
  line: BattleLine = { serial: 0, text: '', event: null };
  /** Newest first. */
  log: string[] = [];
  shownHp: [number, number] = [0, 0];
  shownMaxHp: [number, number] = [0, 0];
  shownCe: [number, number] = [0, 0];
  private queue: BattleEvent[] = [];
  private wait = 0;
  private state: BattleState | null = null;
  private mySide: Side = 0;

  get playing(): boolean { return this.queue.length > 0 || this.wait > 0; }

  /** Clears everything and shows the given state's health. */
  reset(state: BattleState, mySide: Side = 0, text = ''): void {
    this.queue = []; this.wait = 0; this.log = []; this.mySide = mySide;
    this.state = state;
    this.sync(state);
    this.show(text, null, false);
  }

  /** Queues a resolved turn; `state` is the engine state after it. */
  play(state: BattleState, events: BattleEvent[]): void {
    this.state = state;
    this.queue.push(...events);
    if (this.wait <= 0) this.next();
  }

  tick(deltaMs: number): void {
    if (!this.playing) return;
    this.wait -= Math.max(0, deltaMs);
    while (this.wait <= 0 && this.queue.length) this.next();
    if (this.wait <= 0 && !this.queue.length && this.state) { this.wait = 0; this.sync(this.state); }
  }

  /** Shows the rest of the queued text at once (effects are skipped). */
  skip(): void {
    for (const event of this.queue.splice(0)) this.log.unshift(event.text);
    this.log.length = Math.min(this.log.length, 60);
    this.wait = 0;
    if (this.state) this.sync(this.state);
  }

  /** Shows a message that is not part of the turn (prompts, errors). */
  show(text: string, event: BattleEvent | null, logged = true): void {
    this.line = { serial: this.line.serial + 1, text, event };
    if (logged && text) { this.log.unshift(text); this.log.length = Math.min(this.log.length, 60); }
  }

  private next(): void {
    const event = this.queue.shift();
    if (!event) return;
    this.shownHp = [...event.hp];
    this.shownMaxHp = [...event.maxHp];
    this.shownCe = [...event.ce];
    this.show(event.text, event);
    this.wait += event.type === 'move' ? MOVE_LINE_MS : LINE_MS;
    if (this.state) this.onEvent(event, this.state);
    if (event.type === 'move' && event.side !== undefined && this.state) this.onEffect(effectCue(this.state, event, this.queue, this.mySide));
  }

  private sync(state: BattleState): void {
    this.shownHp = [state.sides[0].hp, state.sides[1].hp];
    this.shownMaxHp = [state.sides[0].maxHp, state.sides[1].maxHp];
    this.shownCe = [state.sides[0].ce, state.sides[1].ce];
  }
}
