export type OpponentState = 'idle' | 'windup' | 'guard';

export interface OpponentConfig {
  /** Delay range between the opponent's decisions (attack or guard). */
  minIntervalMs: number;
  maxIntervalMs: number;
  /** Visible wind-up before an attack lands, so the player can see it coming. */
  windupMs: number;
  attackDamage: number;
  /** Chance a decision is "guard" instead of "attack". Attacks into a guard are blocked. */
  guardChance: number;
  guardMs: number;
}

export const DEFAULT_OPPONENT_CONFIG: OpponentConfig = {
  minIntervalMs: 3500,
  maxIntervalMs: 5500,
  windupMs: 900,
  attackDamage: 7,
  guardChance: 0.3,
  guardMs: 1200,
};

export type OpponentAction = 'windup' | 'attack' | 'guard' | 'guard-end';

/**
 * Placeholder opponent: every few seconds it either winds up and attacks, or
 * guards for a moment. `random` is injectable so tests are deterministic.
 */
export class OpponentAI {
  readonly config: OpponentConfig;
  private readonly random: () => number;
  private _state: OpponentState = 'idle';
  private nextAt = 0;

  constructor(config: Partial<OpponentConfig> = {}, random: () => number = Math.random) {
    this.config = { ...DEFAULT_OPPONENT_CONFIG, ...config };
    this.random = random;
  }

  get state(): OpponentState {
    return this._state;
  }

  get isGuarding(): boolean {
    return this._state === 'guard';
  }

  /** Time until the current wind-up lands (0 when not winding up). */
  windupRemaining(now: number): number {
    return this._state === 'windup' ? Math.max(0, this.nextAt - now) : 0;
  }

  reset(now: number): void {
    this._state = 'idle';
    this.nextAt = now + this.interval();
  }

  /** Advances the opponent to `now`; returns what it did (at most one action per call). */
  update(now: number): OpponentAction | null {
    if (now < this.nextAt) return null;
    const c = this.config;
    switch (this._state) {
      case 'idle':
        if (this.random() < c.guardChance) {
          this._state = 'guard';
          this.nextAt = now + c.guardMs;
          return 'guard';
        }
        this._state = 'windup';
        this.nextAt = now + c.windupMs;
        return 'windup';
      case 'windup':
        this._state = 'idle';
        this.nextAt = now + this.interval();
        return 'attack';
      case 'guard':
        this._state = 'idle';
        this.nextAt = now + this.interval();
        return 'guard-end';
    }
  }

  private interval(): number {
    const c = this.config;
    return c.minIntervalMs + this.random() * (c.maxIntervalMs - c.minIntervalMs);
  }
}
