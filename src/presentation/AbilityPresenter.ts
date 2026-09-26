import type { AbilitySlot } from '../combat/AbilityTypes';
import type { CombatEvent, CombatSnapshot } from '../combat/CombatManager';
import type { AudioManager } from './AudioManager';
import type { Point, VfxLayer } from './VfxLayer';
import { voiceLine } from './VoiceLines';

export interface PresenterContext {
  characterId: string;
  color: string;
  /** Which slot an ability belongs to (combat events carry the ability). */
  slotOf(abilityName: string): AbilitySlot | null;
}

/** One entry of the presentation timeline, for checking gesture->impact->damage timing. */
export interface TimelineEntry {
  t: number;
  what: string;
}

/**
 * The opponent is never drawn: it is "in front of you", on the other side of
 * the screen. Attacks travel from the player's hand to this point.
 */
export const TARGET: Point = { x: 0.5, y: 0.42 };

type VfxStyle = 'slash' | 'orb' | 'shadow' | 'soul';

interface CharacterVfx {
  style: VfxStyle;
  /** Colour of the primary and secondary technique. */
  primary: string;
  secondary: string;
}

/** Per-character look of their techniques. Unknown characters fall back to slashes. */
const CHARACTER_VFX: Record<string, CharacterVfx> = {
  gojo: { style: 'orb', primary: '#40c4ff', secondary: '#ff1744' }, // Blue / Red
  sukuna: { style: 'slash', primary: '#ff5252', secondary: '#ff1744' }, // Cleave / Dismantle
  megumi: { style: 'shadow', primary: '#7c4dff', secondary: '#b388ff' }, // shikigami shadows
  mahito: { style: 'soul', primary: '#64ffda', secondary: '#1de9b6' }, // soul energy
};

/** How often energy motes are emitted from a hand holding a sign. */
const HOLD_MOTE_INTERVAL_MS = 70;

/**
 * Turns combat events into effects that come out of the player's own hands
 * on the camera feed: no drawn fighters. Knows nothing about gesture
 * recognition; it only needs to know where the hands are (`handAnchor`).
 *
 * Primary: fast - the technique leaves the hand and hits almost at once.
 * Secondary: the energy visibly charges on the hand (following it) for the
 * whole wind-up, then releases with a big hit, shake and brief slow-motion.
 */
export class AbilityPresenter {
  readonly timeline: TimelineEntry[] = [];
  private readonly stage: HTMLElement;
  private readonly vfx: VfxLayer;
  private readonly audio: AudioManager;
  /** Live position of the hand(s) making the sign, in stage fractions, or null. */
  private readonly handAnchor: () => Point | null;
  private ctx: PresenterContext | null = null;
  private domainWasReady = false;
  private lastMote = 0;
  /** Where the hand was when the current attack was cast (fallback if tracking drops). */
  private castFrom: Point = { x: 0.5, y: 0.7 };

  constructor(stage: HTMLElement, vfx: VfxLayer, audio: AudioManager, handAnchor: () => Point | null) {
    this.stage = stage;
    this.vfx = vfx;
    this.audio = audio;
    this.handAnchor = handAnchor;
  }

  setContext(ctx: PresenterContext): void {
    this.ctx = ctx;
    this.domainWasReady = false;
    this.vfx.clear();
  }

  /** Records a moment in the timeline (kept short). */
  mark(what: string): void {
    this.timeline.push({ t: Math.round(performance.now()), what });
    if (this.timeline.length > 50) this.timeline.shift();
    if (import.meta.env.DEV) console.debug(`[timeline] ${what}`);
  }

  /**
   * Per-frame: energy gathers on the hand while a sign is being held, the
   * screen edges show the opponent's intent, and a chime plays when the
   * Domain Meter fills.
   */
  tick(fight: CombatSnapshot, holdingSign: boolean): void {
    const fighting = fight.phase === 'fighting' && !fight.paused;
    this.stage.classList.toggle('threat-windup', fighting && fight.opponentState === 'windup');
    this.stage.classList.toggle('threat-guard', fighting && fight.opponentState === 'guard');

    const now = performance.now();
    const hand = this.handAnchor();
    if (this.ctx && holdingSign && hand && now - this.lastMote > HOLD_MOTE_INTERVAL_MS) {
      this.lastMote = now;
      this.vfx.motes(hand, this.look().primary, 3);
    }

    // The domain's environment only exists while a domain is up.
    this.stage.classList.toggle('domain-active', fight.domain !== null);
    if (!fight.domain && !this.stage.classList.contains('domain-transition')) this.clearDomainEnvironment();

    if (fight.domainReady && !this.domainWasReady) {
      this.audio.play('domain-ready');
      if (hand) this.vfx.burst(hand, '#ffd740', 140, 700);
    }
    this.domainWasReady = fight.domainReady;
  }

  handle(event: CombatEvent): void {
    const ctx = this.ctx;
    if (!ctx) return;
    switch (event.type) {
      case 'cast': {
        const slot = ctx.slotOf(event.ability.name);
        this.mark(`cast ${event.ability.name} (impact in ${event.impactInMs}ms)`);
        this.speak(ctx, slot, event.ability.name);
        this.castFrom = this.handAnchor() ?? this.castFrom;
        if (slot === 'secondary') this.chargeSecondary(event.impactInMs);
        else this.castPrimary(event.impactInMs);
        break;
      }
      case 'hit': {
        const heavy = ctx.slotOf(event.ability.name) === 'secondary';
        this.mark(`impact ${event.ability.name} -${event.damage}hp`);
        if (heavy) this.releaseSecondary();
        this.impact(heavy, event.damage);
        break;
      }
      case 'blocked':
        this.mark(`blocked ${event.ability.name}`);
        if (ctx.slotOf(event.ability.name) === 'secondary') this.releaseSecondary();
        this.vfx.burst(TARGET, '#90caf9', 140, 300);
        this.vfx.sparks(TARGET, '#90caf9', 22, 320);
        this.vfx.floatText({ x: TARGET.x, y: TARGET.y + 0.02 }, 'BLOCKED', '#90caf9', 28);
        this.audio.play('blocked');
        break;
      case 'on-cooldown':
        this.audio.play('on-cooldown');
        break;
      case 'domain-not-ready':
        this.audio.play('not-ready');
        break;
      case 'domain-activated':
        // The cinematic itself is DomainSequence (the opening hit shows on the HP bar).
        this.mark(`domain ${event.ability.name} -${event.damage}hp (${event.durationMs}ms)`);
        break;
      case 'domain-already-active':
        this.audio.play('not-ready');
        break;
      case 'domain-tick':
        this.domainTick(event.damage);
        break;
      case 'domain-ended':
        this.mark(`domain ended ${event.name}`);
        this.clearDomainEnvironment();
        this.vfx.flash('#fff', 0.35, 500);
        this.audio.play('domain-collapse');
        break;
      case 'opponent-windup':
        this.audio.play('opponent-windup');
        break;
      case 'opponent-guard':
        this.audio.play('guard-up');
        break;
      case 'opponent-attack':
        // The unseen opponent strikes the player: claw marks across the screen.
        this.mark(`player hit -${event.damage}hp`);
        this.vfx.claws('#ff1744');
        this.vfx.flash('#ff1744', 0.35, 280);
        this.vfx.floatText({ x: 0.2, y: 0.3 }, `-${event.damage}`, '#ff5252', 34);
        this.shake('small');
        this.audio.play('player-hurt');
        break;
      case 'match-over':
        this.mark(`match ${event.result}`);
        if (event.result === 'won') {
          this.vfx.burst(TARGET, '#ffd740', 800, 1200);
          this.vfx.sparks(TARGET, '#ffd740', 80, 700);
        } else {
          this.vfx.flash('#ff1744', 0.6, 900);
        }
        this.audio.play(event.result === 'won' ? 'victory' : 'defeat');
        break;
    }
  }

  // ---------- domain ----------

  /** A sure-hit strike of the active domain, in the character's style. */
  private domainTick(damage: number): void {
    const look = this.look();
    const at = { x: TARGET.x + (Math.random() - 0.5) * 0.3, y: TARGET.y + (Math.random() - 0.5) * 0.25 };
    switch (look.style) {
      case 'slash': { // Malevolent Shrine: cuts from nowhere
        const a = Math.random() * Math.PI;
        const d = { x: Math.cos(a) * 0.18, y: Math.sin(a) * 0.18 };
        this.vfx.slash({ x: at.x - d.x, y: at.y - d.y }, { x: at.x + d.x, y: at.y + d.y }, Math.random() < 0.5 ? '#fff' : look.primary, 5, 70);
        break;
      }
      case 'orb': // Unlimited Void: flickers of infinite information
        this.vfx.sparks(at, Math.random() < 0.5 ? '#e1f5fe' : look.primary, 14, 260);
        break;
      case 'shadow': // Chimera Shadow Garden: a shikigami lunges out of the shadows
        this.vfx.smoke(at, '#12001f', 5, 50, 600);
        this.vfx.slash({ x: at.x - 0.12, y: at.y + 0.12 }, { x: at.x + 0.12, y: at.y - 0.12 }, look.primary, 7, 90);
        break;
      default: // Self-Embodiment of Perfection: the soul is reshaped
        this.vfx.motes(at, look.primary, 10, 40);
        this.vfx.burst(at, look.primary, 50, 300);
    }
    this.vfx.floatText(at, `-${damage}`, '#ffd740', 22, 700);
    this.audio.play('impact-light');
  }

  private clearDomainEnvironment(): void {
    for (const cls of [...this.stage.classList]) if (cls.startsWith('domain-env-')) this.stage.classList.remove(cls);
  }

  // ---------- techniques ----------

  /** Fast technique: leaves the hand and reaches the target by the impact moment. */
  private castPrimary(impactInMs: number): void {
    const look = this.look();
    const from = this.castFrom;
    const through = beyond(from, TARGET, 0.35);
    this.audio.play('primary-cast');
    switch (look.style) {
      case 'orb': // Lapse: Blue - a small orb forms on the hand and fires as a beam
        this.vfx.orb(() => this.handAnchor(), look.primary, 70, impactInMs + 120);
        setTimeout(() => this.vfx.beam(this.handAnchor() ?? from, TARGET, look.primary, 26, 260), impactInMs);
        break;
      case 'shadow': // shadows pour from the hand, then a dark strike
        this.vfx.smoke(from, '#1a0033', 6, 45, 600);
        this.vfx.slash(from, through, look.primary, 8, impactInMs);
        break;
      case 'soul': // soul wisps stream out of the hand
        this.vfx.motes(from, look.primary, 14, 60);
        this.vfx.beam(from, TARGET, look.primary, 14, impactInMs + 200);
        break;
      default: // slash - a cut rips out of the hand through the screen
        this.vfx.slash(from, through, look.primary, 7, impactInMs);
        this.vfx.slash(offset(from, 0.03), offset(through, 0.03), '#fff', 3, impactInMs, 30);
    }
  }

  /** Strong technique: energy charges on (and follows) the hand for the whole wind-up. */
  private chargeSecondary(windupMs: number): void {
    const look = this.look();
    const hand = () => this.handAnchor();
    this.audio.play('secondary-charge');
    this.vfx.chargeRing(hand, look.secondary, windupMs);
    this.vfx.orb(hand, look.secondary, look.style === 'orb' ? 130 : 90, windupMs, look.style === 'shadow' ? '#000' : '#fff');
    if (look.style === 'shadow') this.vfx.smoke(this.castFrom, '#12001f', 10, 70, windupMs);
    if (look.style === 'soul') this.vfx.motes(this.castFrom, look.secondary, 20, 90);
  }

  /** The charged technique leaves the hand (called at impact, hit or blocked). */
  private releaseSecondary(): void {
    const look = this.look();
    const from = this.handAnchor() ?? this.castFrom;
    this.audio.play('secondary-release');
    switch (look.style) {
      case 'orb': // Reversal: Red - a huge blast from the hand
        this.vfx.beam(from, TARGET, look.secondary, 70, 420);
        this.vfx.burst(from, look.secondary, 260, 450);
        break;
      case 'shadow':
        this.vfx.smoke(TARGET, '#12001f', 14, 90, 900);
        this.vfx.slash(from, beyond(from, TARGET, 0.4), look.secondary, 12, 90);
        this.vfx.slash(offset(from, -0.05), beyond(offset(from, -0.05), TARGET, 0.4), look.primary, 9, 90, 70);
        break;
      case 'soul':
        this.vfx.beam(from, TARGET, look.secondary, 44, 500);
        this.vfx.motes(TARGET, look.secondary, 30, 160);
        break;
      default: // Dismantle - a flurry of cuts across the whole screen
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI;
          const r = 0.45;
          const c = { x: TARGET.x + (Math.random() - 0.5) * 0.3, y: TARGET.y + (Math.random() - 0.5) * 0.3 };
          const d = { x: Math.cos(a) * r, y: Math.sin(a) * r };
          this.vfx.slash({ x: c.x - d.x, y: c.y - d.y }, { x: c.x + d.x, y: c.y + d.y }, i % 2 ? '#ffffff' : look.secondary, 9, 80, i * 45);
        }
    }
  }

  /** The hit landing on the unseen opponent, through the screen. */
  private impact(heavy: boolean, damage: number): void {
    const look = this.look();
    this.vfx.floatText({ x: TARGET.x, y: TARGET.y + 0.02 }, `-${damage}`, heavy ? '#ffd740' : '#fff', heavy ? 50 : 34);
    if (heavy) {
      this.vfx.sparks(TARGET, look.secondary, 45, 560);
      this.vfx.burst(TARGET, '#fff', 200);
      this.vfx.flash('#fff', 0.45);
      this.vfx.slowMotion(0.3, 250);
      this.shake('big');
      this.audio.play('impact-heavy');
    } else {
      this.vfx.sparks(TARGET, look.primary, 18, 340);
      this.vfx.burst(TARGET, look.primary, 90, 260);
      this.vfx.flash('#fff', 0.15, 120);
      this.shake('small');
      this.audio.play('impact-light');
    }
  }

  private look(): CharacterVfx {
    const ctx = this.ctx!;
    return CHARACTER_VFX[ctx.characterId] ?? { style: 'slash', primary: ctx.color, secondary: '#fff' };
  }

  private shake(strength: 'small' | 'big'): void {
    this.stage.classList.remove('shake-small', 'shake-big');
    void this.stage.offsetWidth;
    this.stage.classList.add(`shake-${strength}`);
  }

  private speak(ctx: PresenterContext, slot: AbilitySlot | null, fallback: string): void {
    if (!slot) return;
    this.audio.speak(`${ctx.characterId}-${slot}`, voiceLine(ctx.characterId, slot, fallback));
  }
}

/** A point past `to`, continuing the line from `from` (so a slash runs through the target). */
function beyond(from: Point, to: Point, extra: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: to.x + (dx / len) * extra, y: to.y + (dy / len) * extra };
}

function offset(p: Point, d: number): Point {
  return { x: p.x + d, y: p.y - d };
}
