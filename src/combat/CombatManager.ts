import type { CharacterDefinition } from '../characters/CharacterTypes';
import { characterGestures } from '../characters/CharacterTypes';
import type { GestureType } from '../handTracking/GestureTypes';
import { GESTURE_LABELS } from '../handTracking/GestureTypes';
export const BALANCE = { punchDamage: 4, abilityDamage: 8, ultimateDamage: 30, punchCooldown: 700, abilityCooldown: 1800, enemyInterval: 3000, enemyDamage: 5 };
export class CombatManager {
  playerHp = 100;
  opponentHp = 100;
  meter = 0;
  elapsed = 0;
  turn: 'player' | 'enemy' = 'player';
  turnNumber = 1;
  private responseAt = 0;
  technique = '';
  techniqueSerial = 0;
  cooldowns = new Map<GestureType, number>();
  status: 'ready' | 'playing' | 'won' | 'lost' = 'ready';
  message = 'Start a match when ready.';
  character: CharacterDefinition;
  constructor(character: CharacterDefinition) { this.character = character; }
  reset(character = this.character): void {
    this.character = character; this.playerHp = 100; this.opponentHp = 100; this.meter = 0;
    this.elapsed = 0; this.turn = 'player'; this.turnNumber = 1; this.responseAt = 0; this.technique = ''; this.techniqueSerial++; this.cooldowns.clear();
    this.status = 'ready'; this.message = 'Start a match when ready.';
  }
  start(): void { if (this.status === 'ready') { this.status = 'playing'; this.message = 'Your turn. Choose a technique or perform its sign.'; } }
  remaining(gesture: GestureType): number { return Math.max(0, (this.cooldowns.get(gesture) ?? 0) - this.turnNumber); }
  attack(gesture: GestureType): boolean {
    if (this.status !== 'playing' || this.turn !== 'player' || !characterGestures(this.character).includes(gesture)) return false;
    const ultimate = this.character.ultimate?.gesture === gesture;
    if (ultimate && this.meter < 100) { this.message = 'Ultimate unavailable — build your meter to 100.'; return false; }
    if (this.remaining(gesture)) { this.message = `${GESTURE_LABELS[gesture]} is cooling down.`; return false; }
    const punch = gesture === 'BASIC_PUNCH';
    const damage = ultimate ? BALANCE.ultimateDamage : punch ? BALANCE.punchDamage : BALANCE.abilityDamage;
    this.opponentHp = Math.max(0, this.opponentHp - damage);
    this.meter = ultimate ? 0 : Math.min(100, this.meter + (punch ? 10 : 20));
    this.cooldowns.set(gesture, this.turnNumber + (punch ? 1 : 2));
    this.technique = GESTURE_LABELS[gesture]; this.techniqueSerial++;
    this.turn = 'enemy'; this.responseAt = this.elapsed + 1500;
    this.message = `${GESTURE_LABELS[gesture]} hit for ${damage}. Opponent responding…`;
    if (!this.opponentHp) { this.status = 'won'; this.message = 'Victory! Restart to play again.'; }
    return true;
  }
  tick(deltaMs: number): void {
    if (this.status !== 'playing') return;
    this.elapsed += Math.max(0, deltaMs);
    if (this.turn === 'enemy' && this.elapsed >= this.responseAt) {
      this.playerHp = Math.max(0, this.playerHp - BALANCE.enemyDamage);
      this.technique = 'Counter strike'; this.techniqueSerial++;
      if (!this.playerHp) { this.status = 'lost'; this.message = 'Defeat. Restart and try again.'; }
      else { this.turn = 'player'; this.turnNumber++; this.message = `Opponent dealt ${BALANCE.enemyDamage}. Your turn.`; }
    }
  }
}
