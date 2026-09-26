import type { CharacterDefinition } from '../characters/CharacterTypes';
import { characterGestures } from '../characters/CharacterTypes';
import type { GestureType } from '../handTracking/GestureTypes';
import { GESTURE_LABELS } from '../handTracking/GestureTypes';
import { UNIVERSAL, PASSIVE_CUES } from './CombatRules';
import { rollBlackFlash, straightHands, rollCurse, uzumaki, COPY_POOL } from './FinalCharacterRules';

export type CombatAction = GestureType | 'HOLLOW_PURPLE';
type Side = 'player' | 'enemy';
export interface FighterState {
  character: CharacterDefinition;
  hp: number;
  maxHp: number;
  meter: number;
  turns: number;
  redUses: number;
  blueUses: number;
  recovery: number;
  voidAttacks: number;
  dogsTurns: number;
  usedSummons: Set<GestureType>;
  cooldowns: Map<CombatAction, number>;
  summonCountdown: number | null;
  mahoraga: boolean;
  adaptation: number;
  graniteDamage: number;
  lastShikigamiTurn: number | null;
  bloodStacks: number;
  bloodDamageRemainder: number;
  bleedingTurns: number;
  bloodBlindTurns: number;
  fingers: number;
  curseGuard: boolean;
  cursePause: number;
  curseGrade: string;
  weaponBonus: number;
  purge: boolean;
  borrowedSummons: Set<GestureType>;
}
export const MAHORAGA = { maxHp: 30, damage: 30, damageMultiplierPerTurn: 0.5 } as const;
const makeFighter = (character: CharacterDefinition): FighterState => ({
  character, hp: character.id === 'sukuna' ? 175 : UNIVERSAL.maxHp, maxHp: character.id === 'sukuna' ? 175 : UNIVERSAL.maxHp, meter: 0, turns: 0, redUses: 0, blueUses: 0,
  recovery: 0, voidAttacks: 0, dogsTurns: 0, usedSummons: new Set(), cooldowns: new Map(),
  summonCountdown: null, mahoraga: false, adaptation: 0,
  graniteDamage: 25, lastShikigamiTurn: null,
  bloodStacks: 0, bloodDamageRemainder: 0, bleedingTurns: 0, bloodBlindTurns: 0, fingers: 0, curseGuard: false, cursePause: 0, curseGrade: '', weaponBonus: 0, purge: false, borrowedSummons: new Set(),
});
const actionLabel = (action: CombatAction) => action === 'HOLLOW_PURPLE' ? 'Hollow Purple' : GESTURE_LABELS[action];

export interface PassivePopup { serial: number; side: Side; character: string; name: string; message: string; batch: number; }
export class CombatManager {
  lastCastBlackFlash=false;
  onBlackFlash:(action:CombatAction,side:'player'|'enemy')=>void=()=>{};
  onCast: (action:CombatAction,side:'player'|'enemy')=>void=()=>{};
  passivePopup: PassivePopup | null = null;
  private passiveQueue: PassivePopup[] = [];
  private passiveTime = 0;
  private passiveSerial = 0;
  private passiveBatch = 0;
  private passive(f: FighterState): void {
    const cue = PASSIVE_CUES[f.character.id];
    if (!cue) return;
    this.passiveQueue.push({ ...cue, character: f.character.name, side: f === this.player ? 'player' : 'enemy', serial: ++this.passiveSerial, batch: this.passiveBatch });
    this.note(cue.message);
  }
  showNextPassive(): void {
    if (this.passivePopup) return;
    this.passiveQueue.sort((a,b) => a.batch - b.batch || (a.side === 'player' ? 0 : 1) - (b.side === 'player' ? 0 : 1));
    this.passivePopup = this.passiveQueue.shift() ?? null;
    this.passiveTime = 0;
  }

  player: FighterState;
  opponent: FighterState;
  elapsed = 0;
  turn: Side = 'player';
  turnNumber = 1;
  private responseAt = 0;
  technique = '';
  techniqueSerial = 0;
  status: 'ready' | 'playing' | 'won' | 'lost' = 'ready';
  message = 'Start a match when ready.';
  log: string[] = [];
  private random: () => number;
  opponentMode: 'bot' | 'human';
  constructor(character: CharacterDefinition, random: () => number = Math.random, opponentMode: 'bot' | 'human' = 'bot') {
    this.opponentMode = opponentMode;
    this.random = random;
    this.player = makeFighter(character); this.opponent = makeFighter(character);
  }
  get character(): CharacterDefinition { return this.player.character; }
  get playerHp(): number { return this.player.hp; }
  get opponentHp(): number { return this.opponent.hp; }
  get meter(): number { return this.player.meter; }
  reset(character = this.character, opponent = this.opponent.character): void {
    this.lastCastBlackFlash=false;
    this.player = makeFighter(character); this.opponent = makeFighter(opponent);
    this.elapsed = 0; this.turn = 'player'; this.turnNumber = 1; this.responseAt = 0;
    this.technique = ''; this.techniqueSerial++; this.log = [];
    this.passivePopup = null; this.passiveQueue = []; this.passiveTime = 0;
    this.status = 'ready'; this.message = 'Start a match when ready.';
  }
  private note(text: string): void { this.message = text; this.log.unshift(text); this.log.length = Math.min(this.log.length, 30); }
  start(): void { if (this.status === 'ready') { this.status = 'playing'; this.passiveBatch++; for (const f of [this.player, this.opponent]) if (f.character.id === 'ryu' || f.character.id === 'gojo' || f.character.id === 'toji' || f.character.id === 'yuta') this.passive(f); this.beginTurn('player'); } }
  actions(fighter = this.player): CombatAction[] {
    if (fighter.mahoraga) return ['BASIC_PUNCH'];
    return [...characterGestures(fighter.character), ...fighter.borrowedSummons, ...(fighter.character.id === 'gojo' ? ['HOLLOW_PURPLE' as const] : [])];
  }
  cooldownDuration(action: CombatAction, fighter = this.player): number {
    if (fighter.borrowedSummons.has(action as GestureType) || fighter.character.id === 'megumi' || fighter.mahoraga || action === 'BASIC_PUNCH' || action === 'HOLLOW_PURPLE' || action === fighter.character.ultimate?.gesture) return 0;
    if (fighter.character.id === 'ryu' && action === 'GRANITE_BLAST') return 1;
    return fighter.character.id === 'gojo' && (action === 'REVERSAL_RED' || action === 'AMPLIFICATION_BLUE') ? 3 : 2;
  }
  remaining(action: CombatAction, fighter = this.player): number {
    return Math.min(this.cooldownDuration(action, fighter), Math.max(0, (fighter.cooldowns.get(action) ?? 0) - fighter.turns));
  }
  unavailable(action: CombatAction, fighter = this.player): string | null {
    if (!this.actions(fighter).includes(action)) return 'Not available to this fighter';
    if (fighter.purge) return 'Must expel cursed energy this turn';
    if (fighter.bloodBlindTurns) return 'Must spend this turn wiping blood from eyes';
    if (fighter.recovery) return `Recovering: ${fighter.recovery} turn(s)`;
    const remaining = this.remaining(action, fighter);
    if (remaining) return `Cooldown: ${remaining} own turn(s) remaining`;
    const ultimate = action === fighter.character.ultimate?.gesture || action === 'HOLLOW_PURPLE';
    if (action === 'HOLLOW_PURPLE' && (fighter.redUses < 2 || fighter.blueUses < 2)) return `Unlock: Red ${Math.min(2,fighter.redUses)}/2 · Blue ${Math.min(2,fighter.blueUses)}/2`;
    const cost = action === 'YUJI_ULTIMATE' ? 80 : 100;
    if (ultimate && fighter.meter < cost) return `Needs ${cost} meter`;
    if (fighter.usedSummons.has(action as GestureType)) return 'Already summoned this match';
    if (action === 'MAHORAGA') {
      if (fighter.summonCountdown !== null) return 'Already summoning';
      if (fighter.hp >= 50) return 'Requires less than 50 HP';
    }
    return null;
  }
  private other(side: Side): Side { return side === 'player' ? 'enemy' : 'player'; }
  private fighter(side: Side): FighterState { return side === 'player' ? this.player : this.opponent; }
  maxMeter(f = this.player): number { return f.character.id === 'sukuna' ? 150 : 100; }
  private gain(f: FighterState, amount: number): void {
    const previous = f.meter;
    f.meter = Math.min(this.maxMeter(f), Math.max(0, f.meter + amount));
    if (f.character.id === 'gojo' && !f.mahoraga && previous >= 40 && f.meter < 40) this.passive(f);
  }
  private loseHp(f: FighterState, damage: number): number {
    const lost = Math.min(f.hp, damage);
    f.hp = Math.max(0, f.hp - damage);
    if (f.character.id === 'choso') {
      const total = f.bloodDamageRemainder + lost;
      const stacks = Math.floor(total / 10);
      f.bloodStacks += stacks; f.bloodDamageRemainder = total % 10;
      if (stacks) this.passive(f);
      if (stacks) this.note(`Flowing Red Scale: ${f.character.name} gained ${stacks} blood stack(s), now ${f.bloodStacks}.`);
    }
    return lost;
  }
  private hurt(f: FighterState, base: number, kind: 'basic' | 'technique' | 'ultimate' | 'passive' = 'passive', source?: FighterState): number {
    if (f.character.id === 'toji' && kind === 'passive') return 0;
    const bypass = source?.character.id === 'toji';
    if (f.character.id === 'yuji') {
      if (kind === 'technique') base *= 2;
      if (kind === 'ultimate' && !bypass) base *= .67;
    }
    const reduction = bypass ? 0 : f.curseGuard ? .33 : f.mahoraga ? f.adaptation : f.character.id === 'gojo' && f.meter < 40 ? 0.20 : 0;
    const damage = Math.floor(base * (1 - reduction));
    return this.loseHp(f, damage);
  }
  private finish(): boolean {
    if (this.opponent.hp <= 0) { this.status = 'won'; this.note('Victory! The opponent has fallen.'); return true; }
    if (this.player.hp <= 0) { this.status = 'lost'; this.note('Defeat. Restart to try again.'); return true; }
    return false;
  }
  private beginTurn(side: Side): void {
    this.turn = side;
    const f = this.fighter(side); const enemy = this.fighter(this.other(side));
    f.curseGuard = false; f.curseGrade = '';
    f.turns++; this.turnNumber = this.player.turns;
    if (f.summonCountdown !== null) {
      f.summonCountdown--;
      if (f.summonCountdown === 0) {
        f.summonCountdown = null; f.mahoraga = true; f.hp = MAHORAGA.maxHp; f.maxHp = MAHORAGA.maxHp; f.meter = 0; f.adaptation = 0.5;
        f.dogsTurns = 0; f.voidAttacks = 0;
        this.note(`${f.character.name} sacrifices himself. Mahoraga takes over with 30 HP.`);
      }
    } else if (f.mahoraga) {
      f.adaptation = 1 - (1 - f.adaptation) * MAHORAGA.damageMultiplierPerTurn;
    }
    if (f.character.id === 'toji' && f.meter >= 100) {
      f.purge = true;
      this.note('Toji must expel cursed energy: lose 20 HP and skip this turn.');
    }
    if (f.character.id === 'geto') {
      if (f.cursePause > 0) { f.cursePause--; this.note(`Curse Swallow: summons paused (${f.cursePause} turn(s) remaining).`); }
      else {
        const grade = rollCurse(this.random); f.curseGrade = String(grade); this.passive(f);
        if (grade === 3 || grade === 2) {
          const damage = this.hurt(enemy, grade === 3 ? 5 : 10, 'passive', f);
          this.note(`Grade ${grade} curse deals ${damage} damage.`);
        }
        if (grade === 2 || grade === 1) this.gain(f, 10);
        if (grade === 1) f.curseGuard = true;
        if (grade === 'special') this.gain(f, 50);
        if (this.finish()) return;
      }
    }
    if (f.bleedingTurns > 0) {
      f.bleedingTurns--;
      const damage = this.hurt(f, 5);
      this.note(`Supernova blood damage: ${f.character.name} takes ${damage}. ${f.bleedingTurns} turn(s) remain.`);
      if (this.finish()) return;
    }
    if (!f.mahoraga && f.character.id === 'megumi' && this.random() < 0.10) {
      this.passive(f);
      const damage = this.hurt(enemy, 10, 'passive', f); this.gain(f, 10);
      this.note(`Shadow Dweller: ${f.character.name} sabotages the enemy for ${damage} damage and gains 10 meter.`);
      if (this.finish()) return;
    }
    if (f.purge) this.note('Toji must expel cursed energy this turn.');
    else if (f.bloodBlindTurns) this.note(`${f.character.name} must spend this turn wiping blood from their eyes.`);
    else if (f.recovery) this.note(`${f.character.name} cannot attack this turn: recovering from Hollow Purple (${f.recovery} turns left).`);
    else if (f.summonCountdown !== null) this.note(`${f.character.name}: Mahoraga arrives in ${f.summonCountdown} turn(s). Choose an attack.`);
    else this.note(`${side === 'player' ? 'Your' : 'Opponent’s'} turn${f.mahoraga ? ' — Mahoraga' : ''}.`);
    this.responseAt = this.elapsed + UNIVERSAL.responseMs;
  }
  attack(action: CombatAction): boolean {
    if (this.status !== 'playing' || this.turn !== 'player') return false;
    this.passiveBatch++;
    return this.act('player', action);
  }
  attackFrom(seat: number, action: CombatAction): boolean {
    const side = seat === 0 ? 'player' : 'enemy';
    if (this.opponentMode !== 'human' || this.status !== 'playing' || this.turn !== side) return false;
    this.passiveBatch++;
    return this.act(side, action);
  }
  private act(side: Side, action: CombatAction): boolean {
    const f = this.fighter(side); const enemy = this.fighter(this.other(side));
    const reason = this.unavailable(action, f);
    if (reason) { this.note(reason); return false; }
    this.lastCastBlackFlash=false;
    this.onCast(action,side);
    const ultimate = action === f.character.ultimate?.gesture || action === 'HOLLOW_PURPLE';
    const punch = action === 'BASIC_PUNCH';
    const cooldown = this.cooldownDuration(action, f);
    if (cooldown) f.cooldowns.set(action, f.turns + cooldown + 1);
    this.technique = f.mahoraga ? 'Mahoraga: Strike' : actionLabel(action); this.techniqueSerial++;
    const spentMeter = f.meter;
    const bloodStacks = f.bloodStacks;
    if (action === 'CHOSO_ULTIMATE') f.bloodStacks = 0;
    const graniteDamage = f.graniteDamage;
    if (action === 'GRANITE_BLAST') f.graniteDamage = Math.max(5, f.graniteDamage - 5);
    if (ultimate) this.gain(f, -f.meter);
    else if (!f.mahoraga) this.gain(f, punch ? f.character.id === 'toji' ? 10 : UNIVERSAL.punchMeter : action === 'GRANITE_BLAST' ? 15 : UNIVERSAL.techniqueMeter);
    if (f.character.id === 'yuta') this.gain(f, 5);
    const copied = action === 'YUTA_ULTIMATE';
    if (copied) {
      action = COPY_POOL[Math.floor(this.random() * COPY_POOL.length)];
      this.technique = `Copy: ${actionLabel(action)}`;
      this.note(`Yuta copied ${actionLabel(action)}.`);
    }
    if (f.borrowedSummons.has(action as GestureType)) f.borrowedSummons.delete(action as GestureType);
    if (action === 'REVERSAL_RED') f.redUses++;
    if (action === 'AMPLIFICATION_BLUE') f.blueUses++;
    if (action === 'NUE' || action === 'DIVINE_DOGS' || action === 'MAHORAGA') f.usedSummons.add(action);
    if (action === 'HOLLOW_PURPLE') f.recovery = 3;
    let confused = false;
    if (f.voidAttacks > 0) { f.voidAttacks--; confused = this.random() < 0.33; }
    if (confused) {
      const damage = this.loseHp(f, 5); this.note(`${f.character.name} is disoriented by Unlimited Void and hits themselves for ${damage} damage.`);
    } else if (this.random() < (punch ? UNIVERSAL.punchMiss : UNIVERSAL.techniqueMiss)) {
      this.note(`${this.technique} missed.`);
    } else {
      let damage = punch ? UNIVERSAL.punchDamage : 0;
      if (punch && f.character.id === 'sukuna') damage = 5;
      if (punch && f.character.id === 'toji') damage = 15;
      if (action === 'CURSED_TOOLS') {
        damage = [30,35,40][Math.floor(this.random() * 3)];
        if (this.random() < .33) { enemy.weaponBonus = 10; this.note('The enemy picked up a cursed tool: +10 damage on their next turn.'); }
      }
      if (action === 'CURSE_SWALLOW') { damage = 0; f.hp = Math.min(f.maxHp, f.hp + 30); f.cursePause = 2; f.curseGuard = false; this.note('Curse Swallow heals up to 30 HP. No new curses for two turns.'); }
      if (action === 'GETO_ULTIMATE') { const roll = uzumaki(this.random); damage = roll.damage; this.note(`Uzumaki spirits: ${roll.grades.join(', ')} → ${damage} damage.`); }
      if (action === 'RIKA') { damage = 20; const stolen = Math.min(15, enemy.meter); this.gain(enemy, -stolen); this.gain(f, stolen); this.note(`Rika steals ${stolen} meter.`); }
      if (f.mahoraga) damage = MAHORAGA.damage;
      if (action === 'CLEAVE') damage = 15 + 10 * f.fingers;
      if (action === 'SUKUNA_ULTIMATE') damage = 15 * Math.floor(spentMeter / 30);
      if (action === 'CHOSO_ULTIMATE') {
        damage = 40;
        enemy.bloodBlindTurns = 1;
        enemy.bleedingTurns += bloodStacks;
      }
      if (action === 'GRANITE_BLAST') damage = graniteDamage;
      if (action === 'RYU_ULTIMATE') { damage = 0; f.hp = Math.min(f.maxHp, f.hp + (copied ? 32 : 40)); f.graniteDamage = 25; }
      if (action === 'PIERCING_BLOOD') {
        const recentSummon = enemy.character.id === 'megumi' && !enemy.mahoraga && enemy.lastShikigamiTurn !== null && enemy.turns - enemy.lastShikigamiTurn < 2;
        damage = recentSummon ? 35 : 20;
        if (recentSummon) this.note('Piercing Blood pierces the recent shikigami summon: +15 damage.');
      }
      if (action === 'DIVINE_DOGS' || action === 'NUE') f.lastShikigamiTurn = f.turns;
      if (action === 'REVERSAL_RED') damage = 20;
      if (action === 'AMPLIFICATION_BLUE') { damage = 10; this.gain(enemy, -20); }
      if (action === 'GOJO_ULTIMATE') { damage = 40; enemy.voidAttacks = 2; }
      if (action === 'HOLLOW_PURPLE') damage = 100;
      if (action === 'DIVINE_DOGS') { damage = 0; f.hp = Math.min(f.maxHp, f.hp + 20); f.dogsTurns = 3; }
      if (action === 'NUE') damage = [15,20,30,5][Math.floor(this.random() * 4)];
      if (action === 'MEGUMI_ULTIMATE') {
        damage = 20;
        const summon = this.random() < 0.5 ? 'NUE' : 'DIVINE_DOGS';
        f.usedSummons.delete(summon); if (copied) f.borrowedSummons.add(summon); this.note(`Chimera Shadow Garden refreshes ${GESTURE_LABELS[summon]}.`);
      }
      if (action === 'MAHORAGA') { damage = 0; f.summonCountdown = 3; }
      if (copied) damage = Math.floor((damage + (['MEGUMI_ULTIMATE','SUKUNA_ULTIMATE','CHOSO_ULTIMATE'].includes(action) ? 10 : 0)) * .8);
      let dealt: number;
      if (action === 'YUJI_ULTIMATE') {
        const result = enemy.character.id === 'toji' ? {hits:[10,10,10,10], flashes:0} : straightHands(this.random);
        if(result.flashes){this.lastCastBlackFlash=true;this.onBlackFlash(action,side);}
        if (result.flashes && !copied) this.passive(f);
        dealt = result.hits.reduce((total, hit, index) => total + this.hurt(enemy, (copied ? Math.floor(hit * .8) : hit) + (index === 0 ? f.weaponBonus : 0), 'ultimate', f), 0);
        this.note(`Straight Hands: four punches, ${result.flashes} Black Flash hit(s).`);
      } else {
        if (punch && f.character.id === 'yuji' && enemy.character.id !== 'toji' && rollBlackFlash(this.random)) {
          this.lastCastBlackFlash=true;this.onBlackFlash(action,side);
          damage *= 2; this.passive(f); this.note('Black Flash! Double punch damage.');
        }
        dealt = this.hurt(enemy, damage + (damage > 0 ? f.weaponBonus : 0), ultimate ? 'ultimate' : punch ? 'basic' : 'technique', f);
      }
      if (action === 'CHOSO_ULTIMATE') this.note(`Supernova consumes ${bloodStacks} blood stack(s): 5 damage for ${bloodStacks} turn(s), plus one turn wiping blood.`);
      this.note(action === 'RYU_ULTIMATE' ? `Way Too Sweet! Recovered up to ${copied ? 32 : 40} HP and restored Granite Blast to 25 damage.` : action === 'DIVINE_DOGS' ? 'Demon Dogs summoned for 3 turns. Recovered up to 20 HP.' : action === 'MAHORAGA' ? 'Mahoraga summoning begins. Megumi can fight during the three-turn delay.' : `${this.technique} dealt ${dealt} damage.`);
    }
    if (this.finish()) return true;
    this.endTurn(side); return true;
  }
  private endTurn(side: Side): void {
    const f = this.fighter(side); const enemy = this.fighter(this.other(side));
    f.weaponBonus = 0;
    if (f.dogsTurns > 0) {
      f.dogsTurns--; const damage = this.hurt(enemy, 5, 'technique', f);
      this.note(`Demon Dogs bite for ${damage} damage. ${f.dogsTurns} turn(s) remain.`);
      if (this.finish()) return;
    }
    if (f.character.id === 'sukuna' && f.turns % 3 === 0 && f.fingers < 5) {
      f.fingers++; f.maxHp += 10; f.hp = Math.min(f.maxHp, f.hp + 10); this.gain(f, 10);
      this.passive(f);
      this.note(`Finger Lickin’: Sukuna ate finger ${f.fingers}/5, gained 10 HP and 10 meter. Cleave now deals ${15 + 10 * f.fingers}.`);
    }
    this.beginTurn(this.other(side));
  }
  private chooseEnemyAction(): CombatAction {
    const f = this.opponent;
    const available = this.actions(f).filter(action => !this.unavailable(action, f));
    if (available.includes('HOLLOW_PURPLE')) return 'HOLLOW_PURPLE';
    if (f.character.ultimate && available.includes(f.character.ultimate.gesture)) {
      const waitForOvercharge = f.character.id === 'sukuna' && f.meter < 150 && this.random() < 0.5;
      if (!waitForOvercharge) return f.character.ultimate.gesture;
    }
    if (available.includes('MAHORAGA')) return 'MAHORAGA';
    const techniques = available.filter(a => a !== 'BASIC_PUNCH' && a !== f.character.ultimate?.gesture);
    if (techniques.length && this.random() < 0.65) return techniques[Math.floor(this.random() * techniques.length)];
    return 'BASIC_PUNCH';
  }
  tick(deltaMs: number): void {
    this.passiveBatch++;
    if (this.passivePopup) {
      this.passiveTime += Math.max(0, deltaMs);
      if (this.passiveTime >= 2400) this.passivePopup = null;
    }
    this.showNextPassive();
    if (this.status !== 'playing') return;
    this.elapsed += Math.max(0, deltaMs);
    if (this.elapsed < this.responseAt) return;
    const f = this.fighter(this.turn);
    if (f.purge) {
      f.purge = false; f.meter = 0;
      this.loseHp(f, 20); this.note('Toji expels his cursed energy, takes 20 damage, and loses his turn.');
      if (!this.finish()) this.endTurn(this.turn);
    } else if (f.bloodBlindTurns > 0) {
      f.bloodBlindTurns--;
      // A turn spent blinded also counts toward an existing recovery period.
      if (f.recovery > 0) f.recovery--;
      this.note(`${f.character.name} spends the turn wiping blood from their eyes.`);
      this.endTurn(this.turn);
    } else if (f.recovery > 0) {
      f.recovery--; this.note(`${f.character.name} skips a turn to recover (${f.recovery} remaining).`);
      this.endTurn(this.turn);
    } else if (this.turn === 'enemy' && this.opponentMode === 'bot') this.act('enemy', this.chooseEnemyAction());
  }
}
