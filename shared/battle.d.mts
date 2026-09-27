// Types for battle.mjs (the engine is plain JS so the Node server can run it too).

export type Side = 0 | 1;
export type MoveKind = 'strike' | 'technique' | 'ultimate' | 'guard' | 'special';
export interface MoveEffect { type: 'stat' | 'stun' | 'bleed'; target?: 'foe' | 'self'; stat?: 'atk' | 'def' | 'spd'; change?: number; chance: number; }
export interface DomainRules { tick: number; sureHit: boolean; tickAccuracy?: number; stunOnOpen?: boolean; bleedOnOpen?: boolean; ownerDef?: number; copy?: boolean; blackFlashBoost?: number; }
export interface MoveDefinition {
  name: string; kind: MoveKind; power: number; accuracy: number; cost: number; priority: number;
  text: string; lore?: string; effects?: MoveEffect[]; domain?: DomainRules; requires?: string[];
  toughBonus?: number; pierce?: boolean; heal?: number; ceGain?: number; noRepeat?: boolean;
}
export interface CharacterKit { name: string; moves: string[]; domain: boolean; mahoraga?: boolean; resource?: string; passive: { name: string; text: string } }

export interface Fighter {
  id: string; name: string; hp: number; maxHp: number; ce: number;
  stages: { atk: number; def: number; spd: number };
  bleed: number; bleedingTurns: number; bloodBlindTurns: number; stunned: boolean;
  lastMove: string | null; used: string[]; redScale: boolean;
  mahoraga: boolean; mahoragaUsed: boolean; adapt: Record<string, number>; hitBy: string[];
  ownTurns: number; cooldowns: Record<string, number>; redUses: number; blueUses: number;
  recovery: number; voidAttacks: number; dogsTurns: number; summonCountdown: number | null;
  adaptation: number; graniteDamage: number; lastShikigamiTurn: number | null;
  bloodStacks: number; bloodDamageRemainder: number; fingers: number;
  curseGuard: boolean; curseGuardUntil: number; cursePause: number; curseGrade: string;
  weaponBonus: number; purge: boolean; usedSummons: string[]; borrowedSummons: string[];
}
export interface BattleState {
  turn: number;
  sides: [Fighter, Fighter];
  domain: { owner: Side; move: string; turns: number } | null;
  winner: Side | 'draw' | null;
  over: boolean;
}
export interface BattleEvent {
  text: string;
  side?: Side;
  type?: string;
  move?: string;
  /** Visual effect id for a 'move' event. */
  effect?: string;
  amount?: number;
  stat?: string;
  change?: number;
  passive?: string;
  attacker?: Side;
  /** Both fighters' health right after this line. */
  hp: [number, number];
  maxHp: [number, number];
  ce: [number, number];
}
export interface MoveOption { id: string; name: string; reason: string | null }

export const BASE: {
  mahoragaHp: number; adaptStep: number; hp: number; ceMax: number; ceStart: number; ceRegen: number; strikeCe: number;
  critChance: number; critMultiplier: number; powerScale: number; domainTurns: number; bleedTurns: number; bleedDamage: number; maxTurns: number;
};
export const MOVES: Record<string, MoveDefinition>;
export const CHARACTERS: Record<string, CharacterKit>;
export const CHARACTER_IDS: string[];
export const AI: { ceValue: number; temperature: number };
export function maxMeter(fighter: Pick<Fighter, 'id'>): number;
export function seededRandom(seed: number): () => number;
export function createBattle(p1: string, p2: string): BattleState;
export function moveFor(f: Fighter, id: string): string;
export function moveName(f: Fighter, id: string): string;
export function moveOptions(state: BattleState, side: Side): MoveOption[];
export function unavailableReason(state: BattleState, side: Side, id: string): string | null;
export function resolveTurn(state: BattleState, choices: [string, string], random?: () => number): { state: BattleState; events: BattleEvent[] };
export function effectFor(f: Fighter, pick: string): string;
export function chooseMove(state: BattleState, side: Side, random?: () => number): string;
