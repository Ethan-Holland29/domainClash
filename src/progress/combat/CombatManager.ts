import type { EffectCue } from '../rendering/CharacterEffects';
import type { CharacterDefinition } from '../characters/CharacterTypes';
import { BattlePlayback, type BattleLine } from './BattlePlayback';
import {
  chooseMove, createBattle, moveOptions, resolveTurn, unavailableReason,
  type BattleEvent, type BattleState, type Fighter, type MoveOption,
} from '../../../shared/battle.mjs';

/**
 * Solo battle: a Pokémon-style turn against the computer. The player picks a
 * move (hand sign or button), the computer picks its own, the shared engine
 * resolves the turn, and the battle text plays back one line at a time.
 */
export type CombatStatus = 'ready' | 'choosing' | 'resolving' | 'won' | 'lost' | 'draw';

export class CombatManager {
  onResetEffects: () => void = () => {};
  /** Engine state after the last resolved turn (playback may still be showing it). */
  state: BattleState;
  status: CombatStatus = 'ready';
  readonly playback = new BattlePlayback();
  private playerCharacter: CharacterDefinition;
  private enemyCharacter: CharacterDefinition;
  private readonly random: () => number;

  constructor(character: CharacterDefinition, random: () => number = Math.random) {
    this.random = random;
    this.playerCharacter = character;
    this.enemyCharacter = character;
    this.state = createBattle(character.id, character.id);
    this.playback.reset(this.state, 0, 'Start a match when ready.');
  }

  set onEffect(fn: (cue: EffectCue) => void) { this.playback.onEffect = fn; }
  set onVoiceEvent(fn: (event: BattleEvent, state: BattleState) => void) { this.playback.onEvent = fn; }
  get character(): CharacterDefinition { return this.playerCharacter; }
  get opponentCharacter(): CharacterDefinition { return this.enemyCharacter; }
  get player(): Fighter { return this.state.sides[0]; }
  get opponent(): Fighter { return this.state.sides[1]; }
  get playing(): boolean { return this.status === 'choosing' || this.status === 'resolving'; }
  /** The battle-text line currently shown. */
  get line(): BattleLine { return this.playback.line; }
  /** Newest first. */
  get log(): string[] { return this.playback.log; }

  reset(character = this.playerCharacter, opponent = this.enemyCharacter): void {
    this.onResetEffects();
    this.playerCharacter = character;
    this.enemyCharacter = opponent;
    this.state = createBattle(character.id, opponent.id);
    this.status = 'ready';
    this.playback.reset(this.state, 0, 'Start a match when ready.');
  }

  start(): void {
    if (this.status !== 'ready') return;
    this.status = 'choosing';
    this.playback.show(`${this.player.name} vs ${this.opponent.name}! Choose your move.`, null);
  }

  /** Every input the player has, with why any is unavailable this turn. */
  options(): MoveOption[] { return moveOptions(this.state, 0); }

  unavailable(id: string): string | null { return unavailableReason(this.state, 0, id); }

  /** The player's move for this turn (from a hand sign or a button). Returns false if it can't be used now. */
  attack(id: string): boolean {
    if (this.status !== 'choosing') return false;
    const reason = this.unavailable(id);
    if (reason) { this.playback.show(reason, null, false); return false; }
    const foe = chooseMove(this.state, 1, this.random);
    const { state, events } = resolveTurn(this.state, [id, foe], this.random);
    this.state = state;
    this.status = 'resolving';
    this.playback.play(state, events);
    return true;
  }

  /** Advances battle-text playback. */
  tick(deltaMs: number): void {
    if (this.status !== 'resolving') return;
    this.playback.tick(deltaMs);
    if (!this.playback.playing) this.endTurn();
  }

  /** Shows the rest of this turn's text at once. */
  skip(): void {
    if (this.status !== 'resolving') return;
    this.playback.skip();
    this.endTurn();
  }

  private endTurn(): void {
    if (!this.state.over) {
      this.status = 'choosing';
      const stunned = this.player.stunned ? ' You are stunned: this turn\'s move will be lost.' : '';
      this.playback.show(`What will ${this.player.mahoraga ? 'Mahoraga' : this.player.name} do?${stunned}`, null, false);
      return;
    }
    const w = this.state.winner;
    this.status = w === 'draw' ? 'draw' : w === 0 ? 'won' : 'lost';
    this.playback.show(w === 'draw' ? 'Both fighters fell. It\'s a draw!' : w === 0 ? 'Victory! The opponent has fallen.' : 'Defeat. Restart to try again.', null);
  }
}
