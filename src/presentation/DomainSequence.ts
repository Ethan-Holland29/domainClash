import type { DomainCinematic } from '../ui/DomainCinematic';
import type { AudioManager } from './AudioManager';
import type { Point, VfxLayer } from './VfxLayer';

export interface DomainSequenceOptions {
  domainName: string;
  characterId: string;
  color: string;
  /** The player's uploaded (or bundled) domain video, if any. */
  videoUrl: string | null;
  /** Where the hands are, so the domain erupts from them. */
  handAnchor: () => Point | null;
  /** Speaks "Domain Expansion..." (skipped when a video brings its own audio). */
  speak: () => void;
}

/** Timings of the built-in cinematic (ms). */
export const DOMAIN_SEQUENCE_TIMING = {
  introMs: 1100,
  revealMs: 1700,
  transitionMs: 700,
};

/**
 * The Domain Expansion cinematic. Plays while the match is paused (the game
 * pauses combat whenever `playing` is true), then hands back to gameplay,
 * which resumes inside the Domain state.
 *
 *   intro      - screen darkens, camera zooms + distorts, energy bursts from
 *                the hands in slow motion, "DOMAIN EXPANSION" + strong sound
 *   main       - the player's own video if there is one, else a built-in
 *                reveal of the domain's name with themed particles
 *   transition - the camera view shifts into the domain's environment
 */
export class DomainSequence {
  private readonly stage: HTMLElement;
  private readonly vfx: VfxLayer;
  private readonly audio: AudioManager;
  private readonly cinematic: DomainCinematic;
  private readonly title: HTMLDivElement;
  private readonly titleTop: HTMLDivElement;
  private readonly titleName: HTMLDivElement;
  private _playing = false;

  constructor(stage: HTMLElement, vfx: VfxLayer, audio: AudioManager, cinematic: DomainCinematic) {
    this.stage = stage;
    this.vfx = vfx;
    this.audio = audio;
    this.cinematic = cinematic;
    this.title = document.createElement('div');
    this.title.className = 'domain-title';
    this.title.hidden = true;
    this.titleTop = document.createElement('div');
    this.titleTop.className = 'domain-title-top';
    this.titleTop.textContent = 'DOMAIN EXPANSION';
    this.titleName = document.createElement('div');
    this.titleName.className = 'domain-title-name';
    this.title.append(this.titleTop, this.titleName);
    stage.appendChild(this.title);
  }

  get playing(): boolean {
    return this._playing;
  }

  async play(o: DomainSequenceOptions): Promise<void> {
    if (this._playing) return;
    this._playing = true;
    const t = DOMAIN_SEQUENCE_TIMING;
    try {
      // 1. Intro
      this.stage.style.setProperty('--domain-color', o.color);
      this.stage.classList.add('domain-intro');
      this.titleName.textContent = '';
      this.title.classList.remove('reveal');
      this.title.hidden = false;
      const hand = o.handAnchor() ?? { x: 0.5, y: 0.6 };
      this.vfx.slowMotion(0.35, t.introMs);
      this.vfx.orb(() => o.handAnchor(), o.color, 260, t.introMs);
      this.vfx.burst(hand, o.color, 700, t.introMs);
      this.vfx.sparks(hand, o.color, 60, 600);
      this.vfx.flash('#000', 0.6, t.introMs);
      this.audio.play('domain-cast');
      if (!o.videoUrl) o.speak();
      await sleep(t.introMs);

      // 2. Main: the player's video, or the built-in name reveal
      if (o.videoUrl) {
        this.title.hidden = true;
        await this.cinematic.play(o.videoUrl);
      } else {
        this.titleName.textContent = o.domainName.toUpperCase();
        this.title.classList.add('reveal');
        for (let i = 0; i < 4; i++) {
          setTimeout(() => this.vfx.sparks({ x: 0.2 + Math.random() * 0.6, y: 0.3 + Math.random() * 0.4 }, o.color, 30, 500), i * 350);
        }
        await sleep(t.revealMs);
      }

      // 3. Transition into the domain's environment
      this.title.hidden = true;
      this.stage.classList.remove('domain-intro');
      this.stage.classList.add('domain-transition', `domain-env-${o.characterId}`);
      this.vfx.flash(o.color, 0.5, t.transitionMs);
      await sleep(t.transitionMs);
      this.stage.classList.remove('domain-transition');
    } finally {
      this.title.hidden = true;
      this.stage.classList.remove('domain-intro', 'domain-transition');
      this._playing = false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
