import { SYNTHS, type SoundId } from './SoundLibrary';

/**
 * Optional replacement files: src/assets/audio/<sound-id>.mp3 replaces a
 * synthesised effect (e.g. impact-heavy.mp3), and
 * src/assets/audio/voice-<character>-<slot>.mp3 replaces a spoken voice line
 * (e.g. voice-sukuna-primary.mp3). Vite bundles whatever is in the folder.
 */
const AUDIO_FILES = import.meta.glob<string>('/src/assets/audio/*.{mp3,wav,ogg,m4a}', {
  query: '?url',
  import: 'default',
  eager: true,
});

function audioFile(name: string): string | null {
  for (const ext of ['mp3', 'wav', 'ogg', 'm4a']) {
    const url = AUDIO_FILES[`/src/assets/audio/${name}.${ext}`];
    if (url) return url;
  }
  return null;
}

/** Same sound within this window is dropped, so rapid events do not stack into noise. */
const REPEAT_GUARD_MS = 60;

/**
 * Single place all game audio goes through: sound effects (synthesised or
 * replaced by files) and voice lines (recorded file, else text-to-speech).
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer | 'loading' | 'failed'>();
  private readonly lastPlayed = new Map<SoundId, number>();
  private _muted = false;
  private _voice = true;

  constructor() {
    // Browsers only allow audio after a user gesture; start the engine on the first one.
    const unlock = () => this.ensureContext();
    window.addEventListener('pointerdown', unlock, { capture: true, once: true });
    window.addEventListener('keydown', unlock, { capture: true, once: true });
  }

  get muted(): boolean {
    return this._muted;
  }

  get voiceEnabled(): boolean {
    return this._voice;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.8;
    if (muted) speechSynthesis?.cancel();
  }

  setVoiceEnabled(enabled: boolean): void {
    this._voice = enabled;
    if (!enabled) speechSynthesis?.cancel();
  }

  /** Plays a sound effect (replacement file if present, else the synthesised placeholder). */
  play(id: SoundId): void {
    if (this._muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(id) ?? -Infinity) < REPEAT_GUARD_MS) return;
    this.lastPlayed.set(id, now);

    const url = audioFile(id);
    if (url && this.playFile(url)) return;
    SYNTHS[id](ctx, this.master);
  }

  /**
   * Speaks a voice line: voice-<key> file if present, else text-to-speech.
   * A new line interrupts the previous one instead of queueing behind it.
   */
  speak(key: string, text: string): void {
    if (this._muted || !this._voice) return;
    const url = audioFile(`voice-${key}`);
    if (url && this.playFile(url)) return;
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const line = new SpeechSynthesisUtterance(text);
    line.rate = 1.15;
    line.pitch = 0.8;
    line.volume = 0.9;
    speechSynthesis.speak(line);
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this._muted ? 0 : 0.8;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Plays a decoded file; starts decoding it the first time. Returns false while not ready. */
  private playFile(url: string): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.master) return false;
    const cached = this.buffers.get(url);
    if (cached instanceof AudioBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = cached;
      src.connect(this.master);
      src.start();
      return true;
    }
    if (!cached) {
      this.buffers.set(url, 'loading');
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => this.buffers.set(url, buffer))
        .catch(() => this.buffers.set(url, 'failed'));
    }
    return false; // placeholder plays this time; the file is used once decoded
  }
}
