/**
 * Full-window Domain Expansion video. The video's audio starts immediately
 * while the picture is still invisible, then the picture fades in to full
 * opacity and the whole clip plays. At the end (or on skip) it fades out.
 *
 * Videos are user-provided files in src/assets/domains/, named after the
 * character (sukuna.mp4) or the domain gesture id (malevolent-shrine.mp4),
 * with default.mp4 as a fallback for everyone. Vite bundles whatever is in
 * the folder, so adding a file needs no code change.
 */
const DOMAIN_VIDEOS = import.meta.glob<string>('/src/assets/domains/*.{mp4,webm,mov}', {
  query: '?url',
  import: 'default',
  eager: true,
});

export interface CinematicTiming {
  /** Audio plays alone (picture invisible) for this long before the picture starts fading in. */
  audioLeadMs: number;
  /** Time for the picture to go from invisible to full opacity. */
  fadeInMs: number;
  fadeOutMs: number;
}

export const DEFAULT_CINEMATIC_TIMING: CinematicTiming = {
  audioLeadMs: 800,
  fadeInMs: 1500,
  fadeOutMs: 600,
};

/** Finds the video for a character/domain: `<characterId>`, then `<gestureId>`, then `default`. */
export function findDomainVideo(...names: string[]): string | null {
  for (const name of [...names, 'default']) {
    for (const ext of ['mp4', 'webm', 'mov']) {
      const url = DOMAIN_VIDEOS[`/src/assets/domains/${name}.${ext}`];
      if (url) return url;
    }
  }
  return null;
}

export class DomainCinematic {
  private readonly element: HTMLDivElement;
  private readonly video: HTMLVideoElement;
  private readonly hint: HTMLDivElement;
  private readonly timing: CinematicTiming;
  private finish: (() => void) | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | undefined;
  /** Clip loaded ahead of time so the audio starts the instant a domain fires. */
  private preparedUrl: string | null = null;
  /** Sound was blocked: waiting for a click to start the clip with audio. */
  private awaitingClick = false;
  private unlocked = false;

  constructor(parent: HTMLElement = document.body, timing: Partial<CinematicTiming> = {}) {
    this.timing = { ...DEFAULT_CINEMATIC_TIMING, ...timing };
    this.element = document.createElement('div');
    this.element.className = 'domain-cinematic';
    this.element.hidden = true;
    this.element.style.setProperty('--fade-in', `${this.timing.fadeInMs}ms`);
    this.element.style.setProperty('--fade-out', `${this.timing.fadeOutMs}ms`);

    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.hint = document.createElement('div');
    this.hint.className = 'domain-cinematic-hint';
    this.element.append(this.video, this.hint);
    parent.appendChild(this.element);

    this.video.addEventListener('ended', () => this.stop());
    this.video.addEventListener('error', () => {
      if (!this.playing) return; // a failed preload is reported when it is actually played
      console.warn('Domain video failed to play:', this.video.error);
      this.stop();
    });
    this.element.addEventListener('click', () => {
      if (this.awaitingClick) {
        // This click is a user gesture, so the browser now allows sound: start from 0:00 with audio.
        this.awaitingClick = false;
        this.element.classList.remove('needs-click');
        this.hint.textContent = 'Esc or click to skip';
        this.video.currentTime = 0;
        void this.video.play().catch(() => this.stop());
      } else {
        this.stop();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.playing) this.stop();
    });
    // The first click/keypress anywhere authorises this player to make sound later,
    // when a domain fires from a hand sign (which is not a click).
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true, once: true });
    window.addEventListener('keydown', unlock, { capture: true, once: true });
  }

  get playing(): boolean {
    return this.finish !== null;
  }

  /**
   * Loads a clip ahead of time (e.g. the selected character's domain) so it
   * starts, audio included, the instant the domain fires. null unloads.
   */
  prepare(url: string | null): void {
    if (url === this.preparedUrl) return;
    this.preparedUrl = url;
    if (!this.playing) this.load(url);
  }

  /** Plays the clip; resolves once it has finished (or been skipped) and faded out. */
  play(url: string): Promise<void> {
    if (this.playing) return Promise.resolve();
    return new Promise((resolve) => {
      this.finish = resolve;
      if (this.video.getAttribute('src') !== url) this.load(url);
      this.video.currentTime = 0;
      this.video.muted = false;
      this.hint.textContent = 'Esc or click to skip';
      this.element.classList.remove('visible', 'leaving', 'needs-click');
      this.element.hidden = false;

      // Audio starts now; once playback is running, the picture fades in after the audio lead.
      this.video.addEventListener(
        'playing',
        () => {
          this.revealTimer = setTimeout(() => this.element.classList.add('visible'), this.timing.audioLeadMs);
        },
        { once: true },
      );
      this.video.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          // The browser refused sound. Never play silently: ask for one click,
          // which then starts the clip from the beginning with audio.
          console.warn('Browser blocked Domain Expansion audio; waiting for a click.');
          this.awaitingClick = true;
          this.element.classList.add('needs-click');
          this.hint.textContent = 'Click to play with sound · Esc to skip';
        } else {
          console.warn('Domain video could not start:', err);
          this.stop();
        }
      });
    });
  }

  /** Fades out, stops the clip and resolves the pending play(). */
  stop(): void {
    const finish = this.finish;
    if (!finish) return;
    this.finish = null;
    this.awaitingClick = false;
    clearTimeout(this.revealTimer);
    this.element.classList.remove('visible', 'needs-click');
    this.element.classList.add('leaving');
    setTimeout(() => {
      this.video.pause();
      // Keep (or restore) the prepared clip buffered for next time.
      if (this.video.getAttribute('src') !== this.preparedUrl) this.load(this.preparedUrl);
      else this.video.currentTime = 0;
      this.element.hidden = true;
      this.element.classList.remove('leaving');
      finish();
    }, this.timing.fadeOutMs);
  }

  private load(url: string | null): void {
    if (url) this.video.src = url;
    else this.video.removeAttribute('src');
    this.video.load();
  }

  /**
   * Plays a tiny silent clip inside a real user gesture. Safari only lets a
   * media element make sound later if it has played during a gesture once;
   * Chrome remembers the interaction page-wide, so this is harmless there.
   */
  private unlock(): void {
    if (this.unlocked || this.playing) return;
    this.unlocked = true;
    const restore = () => this.load(this.preparedUrl);
    this.video.src = silentWavUrl();
    this.video.muted = false;
    this.video.play().then(() => {
      this.video.pause();
      restore();
    }, restore);
  }
}

let silentUrl: string | null = null;

/** Object URL of 0.1 s of silence (8-bit mono WAV). */
function silentWavUrl(): string {
  if (silentUrl) return silentUrl;
  const samples = 800;
  const buf = new DataView(new ArrayBuffer(44 + samples));
  const text = (o: number, str: string) => [...str].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  buf.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true); // PCM
  buf.setUint16(22, 1, true); // mono
  buf.setUint32(24, 8000, true); // sample rate
  buf.setUint32(28, 8000, true); // byte rate
  buf.setUint16(32, 1, true); // block align
  buf.setUint16(34, 8, true); // bits per sample
  text(36, 'data');
  buf.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) buf.setUint8(44 + i, 128);
  silentUrl = URL.createObjectURL(new Blob([buf.buffer], { type: 'audio/wav' }));
  return silentUrl;
}
