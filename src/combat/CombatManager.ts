import { DEFAULT_DOMAIN_EFFECT, type DomainEffect } from '../domain/DomainEffects';
import { DomainManager } from '../domain/DomainManager';
import type { Ability } from './Ability';
import { ABILITY_SLOTS, MAX_HP, type AbilitySlot } from './AbilityTypes';
import { CooldownManager } from './CooldownManager';
import { HealthSystem } from './HealthSystem';
import { OpponentAI, type OpponentConfig, type OpponentState } from './OpponentAI';

export type MatchPhase = 'fighting' | 'won' | 'lost';

export type CombatEvent =
  | { type: 'cast'; ability: Ability; impactInMs: number }
  | { type: 'hit'; ability: Ability; damage: number; meterGained: number }
  | { type: 'blocked'; ability: Ability }
  | { type: 'on-cooldown'; ability: Ability; remainingMs: number }
  | { type: 'domain-not-ready'; ability: Ability; meter: number }
  | { type: 'domain-already-active'; ability: Ability }
  | { type: 'domain-activated'; ability: Ability; damage: number; durationMs: number; effect: DomainEffect }
  | { type: 'domain-tick'; damage: number }
  | { type: 'domain-ended'; name: string }
  | { type: 'ignored'; ability: Ability; reason: 'match-over' | 'paused' }
  | { type: 'opponent-windup' }
  | { type: 'opponent-guard' }
  | { type: 'opponent-attack'; damage: number }
  | { type: 'match-over'; result: 'won' | 'lost' };

export interface CombatSnapshot {
  phase: MatchPhase;
  paused: boolean;
  playerHp: number;
  opponentHp: number;
  maxHp: number;
  meter: number;
  domainReady: boolean;
  cooldowns: Record<AbilitySlot, number>;
  /** Full cooldown length per ability, for progress displays. */
  cooldownDurations: Record<AbilitySlot, number>;
  opponentState: OpponentState;
  /** Time until the opponent's wind-up lands, 0 if not winding up. */
  opponentWindupMs: number;
  /** The Domain currently up, if any. */
  domain: { name: string; remainingMs: number; durationMs: number; effect: DomainEffect } | null;
}

/**
 * Match rules. Knows nothing about gestures: the game calls useAbility(slot)
 * when a move's hand sign is confirmed, and update(now) every frame.
 *
 * Regular attacks are cast first ("cast" event, cooldown starts) and land
 * after their wind-up ("hit" or "blocked"), so damage happens at the moment
 * the attack animation connects.
 *
 * Domain Expansion opens a timed Domain state (see domain/): sure-hit ticks,
 * damage multiplier, unblockable attacks, optionally a stunned opponent.
 *
 * Time runs on an internal clock that only advances while not paused, so
 * cooldowns, the opponent and the Domain timer freeze during character select
 * and cinematics - the domain's duration starts once play resumes.
 */
export class CombatManager {
  readonly player = new HealthSystem(MAX_HP);
  readonly opponent = new HealthSystem(MAX_HP);
  readonly domain = new DomainManager();
  readonly opponentAI: OpponentAI;
  private readonly cooldowns = new CooldownManager<AbilitySlot>();
  private readonly listeners = new Set<(event: CombatEvent) => void>();
  private abilities: Record<AbilitySlot, Ability>;
  private _phase: MatchPhase = 'fighting';
  private _paused = false;
  private clock = 0;
  private lastRealNow: number | null = null;
  /** Attacks that were cast and are waiting for their impact moment. */
  private pending: { ability: Ability; impactAt: number }[] = [];

  constructor(
    abilities: Record<AbilitySlot, Ability>,
    opponent: Partial<OpponentConfig> = {},
    random: () => number = Math.random,
    domainEffect: DomainEffect = DEFAULT_DOMAIN_EFFECT,
  ) {
    this.abilities = abilities;
    this.domain.setEffect(domainEffect);
    this.opponentAI = new OpponentAI(opponent, random);
    this.opponentAI.reset(0);
  }

  onEvent(listener: (event: CombatEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get phase(): MatchPhase {
    return this._phase;
  }

  get paused(): boolean {
    return this._paused;
  }

  /** Current combat time (ms), advancing only while not paused. */
  get time(): number {
    return this.clock;
  }

  setPaused(paused: boolean): void {
    this._paused = paused;
  }

  /** Starts a fresh match, optionally with a different character's abilities and domain. */
  reset(abilities: Record<AbilitySlot, Ability> = this.abilities, domainEffect?: DomainEffect): void {
    this.abilities = abilities;
    if (domainEffect) this.domain.setEffect(domainEffect);
    this.player.reset();
    this.opponent.reset();
    this.domain.reset();
    this.cooldowns.reset();
    this.pending = [];
    this._phase = 'fighting';
    this.opponentAI.reset(this.clock);
  }

  /** Advances the match clock and the opponent. Call once per frame with real time. */
  update(realNow: number): void {
    const dt = this.lastRealNow === null ? 0 : Math.max(0, realNow - this.lastRealNow);
    this.lastRealNow = realNow;
    if (this._paused || this._phase !== 'fighting') return;
    this.clock += dt;

    // Attacks whose wind-up has finished land now.
    const landing = this.pending.filter((p) => p.impactAt <= this.clock);
    if (landing.length) {
      this.pending = this.pending.filter((p) => p.impactAt > this.clock);
      for (const p of landing) {
        if (this._phase !== 'fighting') break;
        this.emit(this.resolveImpact(p.ability));
        this.checkMatchOver();
      }
      if (this._phase !== 'fighting') return;
    }

    // The Domain: sure-hit ticks, then collapse.
    for (const u of this.domain.update(this.clock)) {
      if (u.type === 'tick') {
        this.emit({ type: 'domain-tick', damage: this.opponent.damage(u.damage) });
        this.checkMatchOver();
        if (this._phase !== 'fighting') return;
      } else {
        this.emit({ type: 'domain-ended', name: this.abilities.ultimate.name });
        this.opponentAI.reset(this.clock); // a stunned opponent recovers
      }
    }

    // A domain that stuns keeps the opponent from acting at all.
    if (this.domain.current(this.clock)?.effect.stunsOpponent) return;

    switch (this.opponentAI.update(this.clock)) {
      case 'windup':
        this.emit({ type: 'opponent-windup' });
        break;
      case 'guard':
        this.emit({ type: 'opponent-guard' });
        break;
      case 'attack': {
        const damage = this.player.damage(this.opponentAI.config.attackDamage);
        this.emit({ type: 'opponent-attack', damage });
        this.checkMatchOver();
        break;
      }
    }
  }

  /** The player performed a move's sign. Returns (and emits) what happened. */
  useAbility(slot: AbilitySlot): CombatEvent {
    const ability = this.abilities[slot];
    const now = this.clock;
    let event: CombatEvent;

    if (this._phase !== 'fighting') {
      event = { type: 'ignored', ability, reason: 'match-over' };
    } else if (this._paused) {
      event = { type: 'ignored', ability, reason: 'paused' };
    } else if (slot === 'ultimate') {
      const result = this.domain.tryActivate(ability.name, now);
      if (result.activated) {
        const effect = result.state.effect;
        if (effect.stunsOpponent) this.opponentAI.reset(now); // cancels a wind-up in progress
        // Opening a Domain is a sure hit: guarding does not stop it.
        event = {
          type: 'domain-activated',
          ability,
          damage: this.opponent.damage(ability.stats.damage),
          durationMs: effect.durationMs,
          effect,
        };
      } else if (result.reason === 'already-active') {
        event = { type: 'domain-already-active', ability };
      } else {
        event = { type: 'domain-not-ready', ability, meter: result.meter };
      }
    } else if (!this.cooldowns.isReady(slot, now)) {
      event = { type: 'on-cooldown', ability, remainingMs: this.cooldowns.remaining(slot, now) };
    } else {
      this.cooldowns.start(slot, now, ability.stats.cooldownMs);
      if (ability.stats.windupMs > 0) {
        // Committed now; hits or gets blocked at impact (see update()).
        this.pending.push({ ability, impactAt: now + ability.stats.windupMs });
        event = { type: 'cast', ability, impactInMs: ability.stats.windupMs };
      } else {
        event = this.resolveImpact(ability);
      }
    }

    this.emit(event);
    this.checkMatchOver();
    return event;
  }

  /** Debug/testing cheat: fills the Domain Meter (only reachable from debug mode). */
  debugFillMeter(): void {
    if (this._phase === 'fighting') this.domain.meter.add(100);
  }

  /**
   * Impact of a regular attack: blocked if the opponent is guarding at that
   * moment - unless a sure-hit Domain is up, which also multiplies damage.
   */
  private resolveImpact(ability: Ability): CombatEvent {
    const domain = this.domain.current(this.clock);
    if (this.opponentAI.isGuarding && !domain?.effect.sureHit) return { type: 'blocked', ability };
    const raw = Math.round(ability.stats.damage * (domain?.effect.damageMultiplier ?? 1));
    const damage = this.opponent.damage(raw);
    const meterGained = this.domain.addMeter(ability.stats.meterGain, this.clock);
    return { type: 'hit', ability, damage, meterGained };
  }

  snapshot(): CombatSnapshot {
    const cooldowns = {} as Record<AbilitySlot, number>;
    const cooldownDurations = {} as Record<AbilitySlot, number>;
    for (const slot of ABILITY_SLOTS) {
      cooldowns[slot] = this.cooldowns.remaining(slot, this.clock);
      cooldownDurations[slot] = this.abilities[slot].stats.cooldownMs;
    }
    const domain = this.domain.current(this.clock);
    return {
      phase: this._phase,
      paused: this._paused,
      playerHp: this.player.current,
      opponentHp: this.opponent.current,
      maxHp: MAX_HP,
      meter: this.domain.meter.value,
      domainReady: this.domain.meter.isFull,
      cooldowns,
      cooldownDurations,
      opponentState: this.opponentAI.state,
      opponentWindupMs: this.opponentAI.windupRemaining(this.clock),
      domain: domain
        ? { name: domain.name, remainingMs: domain.remaining(this.clock), durationMs: domain.effect.durationMs, effect: domain.effect }
        : null,
    };
  }

  private checkMatchOver(): void {
    if (this._phase !== 'fighting') return;
    if (this.opponent.isDead) this._phase = 'won';
    else if (this.player.isDead) this._phase = 'lost';
    else return;
    if (this.domain.endActive()) this.emit({ type: 'domain-ended', name: this.abilities.ultimate.name });
    this.emit({ type: 'match-over', result: this._phase });
  }

  private emit(event: CombatEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
