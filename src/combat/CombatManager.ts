import { isDomain, Moves } from "./MoveCatalog";
import { GameConfig } from "../config/GameConfig";
import { DomainManager } from "../domain/DomainManager";
import { DomainMeter } from "../domain/DomainMeter";
import { Abilities } from "./Ability";
import { AbilityId, CombatRejectReason, MatchState, type ActivateResult, type AbilityDef } from "./AbilityTypes";
import { CooldownManager } from "./CooldownManager";
import { HealthSystem } from "./HealthSystem";

export interface PendingHit {
  ability: AbilityDef;
  applyAt: number;
}

export interface CombatEvent {
  type:
    | "ability_start"
    | "ability_rejected"
    | "hit"
    | "player_hurt"
    | "domain_cinematic"
    | "domain_active"
    | "domain_end"
    | "victory"
    | "defeat";
  abilityId?: AbilityId;
  reason?: string;
  damage?: number;
}

type CombatListener = (event: CombatEvent) => void;

export class CombatManager {
  practiceMode = false;
  readonly playerHp: HealthSystem;
  readonly opponentHp: HealthSystem;
  readonly meter = new DomainMeter();
  readonly domain = new DomainManager();
  readonly cooldowns = new CooldownManager();
  match: MatchState = MatchState.playing;

  lastReject: { abilityId: AbilityId; reason: string; at: number } | null = null;
  lastAbilityName = "";
  lastAbilityAt = 0;

  private regularReadyAt = 0;
  private pending: PendingHit[] = [];
  private listeners = new Set<CombatListener>();
  private opponentTimer = 0;
  private opponentTelegraph = 0;

  constructor() {
    this.playerHp = new HealthSystem(GameConfig.combat.playerMaxHp);
    this.opponentHp = new HealthSystem(GameConfig.combat.opponentMaxHp);
  }

  on(listener: CombatListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset(): void {
    this.playerHp.reset();
    this.opponentHp.reset();
    this.meter.reset();
    this.domain.reset();
    this.cooldowns.reset();
    this.match = MatchState.playing;
    this.pending = [];
    this.regularReadyAt = 0;
    this.opponentTimer = 0;
    this.opponentTelegraph = 0;
    this.lastReject = null;
    this.lastAbilityName = "";
    this.lastAbilityAt = 0;
  }

  tryActivate(abilityId: AbilityId, nowMs: number): ActivateResult {
    const ability = Abilities[abilityId];

    if (this.match === MatchState.victory || this.match === MatchState.defeat) {
      return { ok: false, reason: CombatRejectReason.ended, abilityId };
    }
    if (this.domain.isBusy) {
      return this.reject(abilityId, CombatRejectReason.busy, nowMs);
    }

    if (this.pending.length > 0) return this.reject(abilityId, CombatRejectReason.busy, nowMs);

    if (isDomain(abilityId)) {
      if (!this.cooldowns.isReady(abilityId)) return this.reject(abilityId, CombatRejectReason.cooldown, nowMs);
      if (!this.meter.isFull()) {
        return this.reject(abilityId, CombatRejectReason.meter, nowMs);
      }
      if (!this.domain.canActivate()) {
        return this.reject(abilityId, CombatRejectReason.alreadyActive, nowMs);
      }
      this.domain.beginCinematic(abilityId);
      this.cooldowns.start(abilityId, ability.cooldownMs);
      this.meter.reset();
      this.match = MatchState.cinematic;
      this.lastAbilityName = ability.name;
      this.lastAbilityAt = nowMs;
      this.emit({ type: "domain_cinematic", abilityId });
      this.emit({ type: "ability_start", abilityId });
      return { ok: true, ability };
    }

    if (nowMs < this.regularReadyAt || !this.cooldowns.isReady(abilityId)) {
      return this.reject(abilityId, CombatRejectReason.cooldown, nowMs);
    }

    this.cooldowns.start(abilityId, ability.cooldownMs);
    this.regularReadyAt = nowMs + 1000;
    for(const move of Moves)if(!isDomain(move.id))this.cooldowns.start(move.id,1000);
    this.pending.push({ ability, applyAt: nowMs + ability.windupMs });
    this.lastAbilityName = ability.name;
    this.lastAbilityAt = nowMs;
    this.emit({ type: "ability_start", abilityId });
    return { ok: true, ability };
  }

  update(dtMs: number, nowMs: number): void {
    if (this.match === MatchState.victory || this.match === MatchState.defeat) return;

    this.cooldowns.update(dtMs);

    const domainTick = this.domain.update(dtMs);
    if (domainTick.becameActive) {
      this.match = MatchState.playing;
      this.emit({ type: "domain_active", abilityId: this.domain.abilityId });
    }
    if (domainTick.ended) {
      this.emit({ type: "domain_end", abilityId: this.domain.abilityId });
    }
    if (domainTick.tickDamage > 0 && this.match === MatchState.playing) {
      this.hitOpponent(domainTick.tickDamage, 0);
      this.checkEnd();
      if (this.opponentHp.isDead()) return;
    }

    if (this.domain.isBusy) return;

    this.pending = this.pending.filter((hit) => {
      if (nowMs < hit.applyAt) return true;
      const damage = Math.round(hit.ability.damage * this.domain.damageMultiplier);
      this.hitOpponent(damage, hit.ability.meterGain, hit.ability.id);
      return false;
    });

    this.checkEnd();
    if (this.opponentHp.isDead()) return;

    this.updateOpponent(dtMs);
    this.checkEnd();
  }

  opponentTelegraphRatio(): number {
    if (this.opponentTelegraph <= 0) return 0;
    return 1 - this.opponentTelegraph / GameConfig.combat.opponentTelegraphMs;
  }

  private hitOpponent(damage: number, meterGain: number, abilityId?: AbilityId): void {
    const applied = this.practiceMode ? damage : this.opponentHp.damage(damage);
    if (applied > 0 && meterGain > 0) this.meter.add(meterGain);
    if (applied > 0) this.emit({ type: "hit", abilityId, damage: applied });
  }

  private updateOpponent(dtMs: number): void {
    if (this.practiceMode || this.match !== MatchState.playing) return;

    if (this.opponentTelegraph > 0) {
      this.opponentTelegraph -= dtMs;
      if (this.opponentTelegraph <= 0) {
        const dmg = this.playerHp.damage(GameConfig.combat.opponentDamage);
        this.emit({ type: "player_hurt", damage: dmg });
      }
      return;
    }

    this.opponentTimer += dtMs;
    if (this.opponentTimer >= GameConfig.combat.opponentAttackIntervalMs) {
      this.opponentTimer = 0;
      this.opponentTelegraph = GameConfig.combat.opponentTelegraphMs;
    }
  }

  private checkEnd(): void {
    if (this.match === MatchState.victory || this.match === MatchState.defeat) return;
    if (this.playerHp.isDead()) {
      this.match = MatchState.defeat;
      this.emit({ type: "defeat" });
    } else if (this.opponentHp.isDead()) {
      this.match = MatchState.victory;
      this.emit({ type: "victory" });
    }
    if (this.playerHp.isDead() || this.opponentHp.isDead()) {
      this.pending = [];
      this.domain.reset();
    }
  }

  private reject(abilityId: AbilityId, reason: CombatRejectReason, nowMs: number): ActivateResult {
    this.lastReject = { abilityId, reason, at: nowMs };
    this.emit({ type: "ability_rejected", abilityId, reason });
    return { ok: false, reason, abilityId };
  }

  private emit(event: CombatEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
