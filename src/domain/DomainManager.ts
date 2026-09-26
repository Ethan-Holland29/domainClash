import { AbilityId } from "../combat/AbilityTypes";
import { MoveById } from "../combat/MoveCatalog";
import { GameConfig } from "../config/GameConfig";
export const DomainPhase = { idle: "idle", cinematic: "cinematic", active: "active" } as const;
export type DomainPhase = (typeof DomainPhase)[keyof typeof DomainPhase];

export class DomainManager {
  abilityId: AbilityId = AbilityId.DOMAIN_EXPANSION;
  phase: DomainPhase = DomainPhase.idle;
  remainingMs = 0;
  cinematicRemainingMs = 0;
  private tickAcc = 0;

  get damageMultiplier(): number { return this.isActive ? GameConfig.domain.damageMultiplier : 1; }
  get isBusy(): boolean { return this.phase === DomainPhase.cinematic; }
  get isActive(): boolean { return this.phase === DomainPhase.active; }
  canActivate(): boolean { return this.phase === DomainPhase.idle; }

  beginCinematic(id: AbilityId = AbilityId.DOMAIN_EXPANSION): void {
    if (!this.canActivate()) return;
    this.abilityId = id;
    this.phase = DomainPhase.cinematic;
    this.cinematicRemainingMs = GameConfig.domain.cinematicMs;
    this.remainingMs = this.tickAcc = 0;
  }

  update(dtMs: number): { becameActive: boolean; ended: boolean; tickDamage: number } {
    let becameActive = false, ended = false, tickDamage = 0;
    let elapsed = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
    if (this.isBusy) {
      const used = Math.min(elapsed, this.cinematicRemainingMs);
      this.cinematicRemainingMs -= used;
      elapsed -= used;
      if (this.cinematicRemainingMs === 0) {
        this.phase = DomainPhase.active;
        this.remainingMs = MoveById[this.abilityId].durationMs;
        this.tickAcc = 0;
        becameActive = true;
      }
    }
    if (this.isActive) {
      const activeMs = Math.min(this.remainingMs, elapsed);
      this.remainingMs -= activeMs;
      this.tickAcc += activeMs;
      const ticks = Math.floor(this.tickAcc / GameConfig.domain.tickIntervalMs);
      tickDamage = ticks * GameConfig.domain.tickDamage;
      this.tickAcc -= ticks * GameConfig.domain.tickIntervalMs;
      if (this.remainingMs === 0) { this.phase = DomainPhase.idle; ended = true; }
    }
    return { becameActive, ended, tickDamage };
  }

  reset(): void {
    this.phase = DomainPhase.idle;
    this.remainingMs = this.cinematicRemainingMs = this.tickAcc = 0;
  }
}
