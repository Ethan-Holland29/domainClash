interface MusicTrack {
  title: string;
  src: string;
}

const MUSIC_TRACKS: MusicTrack[] = [
  { title: 'Projection', src: '/audio/jjk-music/projection.mp3' },
  { title: 'Defeat Here', src: '/audio/jjk-music/defeat-here.mp3' },
  { title: 'Working Overtime', src: '/audio/jjk-music/working-overtime.mp3' },
  { title: 'Delirious', src: '/audio/jjk-music/delirious.mp3' },
  { title: 'Climax☆JUMPING!', src: '/audio/jjk-music/climax-jumping.mp3' },
  { title: 'Fight Alongside', src: '/audio/jjk-music/fight-alongside.mp3' },
];

export function shuffledPlaylistIndices(trackCount: number, random: () => number = Math.random): number[] {
  if (!Number.isSafeInteger(trackCount) || trackCount < 1) return [];
  const indices = Array.from({ length: trackCount }, (_unused, index) => index);
  for (let index = indices.length - 1; index > 0; index--) {
    const value = Math.min(1 - Number.EPSILON, Math.max(0, random()));
    const swapIndex = Math.floor(value * (index + 1));
    [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
  }
  return indices;
}

/** Compact local MP3 player that moves between the selection and fight layouts. */
export class PlaylistMiniPlayer {
  private root: HTMLElement;
  private status: HTMLElement;
  private trackName: HTMLElement;
  private playButton: HTMLButtonElement;
  private previousButton: HTMLButtonElement;
  private nextButton: HTMLButtonElement;
  private volumeSlider: HTMLInputElement;
  private audio: HTMLAudioElement;
  private volume = 0.3;
  private voiceDucked = false;
  private volumeRamp: ReturnType<typeof setInterval> | null = null;
  private order = shuffledPlaylistIndices(MUSIC_TRACKS.length);
  private position = 0;
  private history: number[] = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'jjk-music-player';
    this.root.innerHTML = `<span class="jjk-music-icon" aria-hidden="true">♫</span>
      <div class="jjk-music-info"><strong class="jjk-music-track"></strong><small class="jjk-music-status" role="status" aria-live="polite">Ready · 6 songs shuffled</small></div>
      <div class="jjk-music-controls">
        <button class="jjk-music-prev" type="button" aria-label="Previous track" title="Previous track">⏮</button>
        <button class="jjk-music-play" type="button" aria-label="Play music" title="Play music">▶</button>
        <button class="jjk-music-next" type="button" aria-label="Next track" title="Next track">⏭</button>
        <label class="jjk-music-volume" title="Volume">
          <span aria-hidden="true">🔊</span>
        <input class="jjk-music-volume-slider" type="range" min="0" max="100" step="1" value="30" aria-label="Music volume" aria-valuetext="30 percent">
        </label>
      </div>`;
    parent.append(this.root);
    this.status = this.root.querySelector<HTMLElement>('.jjk-music-status')!;
    this.trackName = this.root.querySelector<HTMLElement>('.jjk-music-track')!;
    this.playButton = this.root.querySelector<HTMLButtonElement>('.jjk-music-play')!;
    this.previousButton = this.root.querySelector<HTMLButtonElement>('.jjk-music-prev')!;
    this.nextButton = this.root.querySelector<HTMLButtonElement>('.jjk-music-next')!;
    this.volumeSlider = this.root.querySelector<HTMLInputElement>('.jjk-music-volume-slider')!;
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.volume = 0.3;

    this.playButton.onclick = () => this.togglePlayback();
    this.previousButton.onclick = () => this.previousTrack();
    this.nextButton.onclick = () => this.nextTrack();
    this.volumeSlider.oninput = () => {
      const volume = Number(this.volumeSlider.value);
      this.volume = volume / 100;
      this.applyVolume();
      this.volumeSlider.setAttribute('aria-valuetext', `${volume} percent`);
    };
    this.audio.addEventListener('ended', () => this.nextTrack(true));
    this.audio.addEventListener('error', () => {
      this.status.textContent = 'Could not load this song · skipping…';
      this.nextTrack(true);
    });
    this.loadCurrentTrack();
  }

  mount(parent: HTMLElement, before: Node | null = null): void {
    const reference = before?.parentNode === parent ? before : null;
    parent.insertBefore(this.root, reference);
  }

  private get currentTrackIndex(): number { return this.order[this.position] ?? 0; }

  /** Called directly from the disclaimer button so browsers allow music playback. */
  startFromUserGesture(): void { void this.startCurrentTrack(); }

  /** Fade music down for the full Mahoraga voice sequence, then restore its chosen level. */
  setVoiceDucked(ducked: boolean): void {
    if (ducked === this.voiceDucked) return;
    this.voiceDucked = ducked;
    if (this.volumeRamp) clearInterval(this.volumeRamp);
    const from = this.audio.volume;
    const to = this.volume * (ducked ? 0 : 1);
    const started = performance.now();
    this.volumeRamp = setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / 240);
      this.audio.volume = from + (to - from) * progress;
      if (progress >= 1) {
        if (this.volumeRamp) clearInterval(this.volumeRamp);
        this.volumeRamp = null;
      }
    }, 20);
  }

  private applyVolume(): void { this.audio.volume = this.volume * (this.voiceDucked ? 0.08 : 1); }

  private loadCurrentTrack(): void {
    const track = MUSIC_TRACKS[this.currentTrackIndex];
    this.trackName.textContent = track.title;
    this.audio.src = track.src;
    this.audio.load();
    this.status.textContent = 'Ready · 6 songs shuffled';
  }

  private async togglePlayback(): Promise<void> {
    if (this.audio.paused) {
      try {
        await this.audio.play();
        this.setPlaying(true);
        this.status.textContent = 'Playing shuffled music';
      } catch {
        this.status.textContent = 'Could not start playback · try Play again';
      }
    } else {
      this.audio.pause();
      this.setPlaying(false);
      this.status.textContent = 'Paused';
    }
  }

  private nextTrack(automatic = false): void {
    this.history.push(this.currentTrackIndex);
    const wasPlaying = !this.audio.paused;
    if (this.position + 1 >= this.order.length) {
      const previous = this.currentTrackIndex;
      this.order = shuffledPlaylistIndices(MUSIC_TRACKS.length);
      if (this.order.length > 1 && this.order[0] === previous) [this.order[0], this.order[1]] = [this.order[1], this.order[0]];
      this.position = 0;
    } else {
      this.position++;
    }
    this.loadCurrentTrack();
    if (wasPlaying || automatic) void this.startCurrentTrack();
  }

  private previousTrack(): void {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    const previous = this.history.pop();
    if (previous !== undefined) {
      const wasPlaying = !this.audio.paused;
      this.position = this.order.indexOf(previous);
      this.loadCurrentTrack();
      if (wasPlaying) void this.startCurrentTrack();
      return;
    }
    this.audio.currentTime = 0;
  }

  private async startCurrentTrack(): Promise<void> {
    try {
      await this.audio.play();
      this.setPlaying(true);
      this.status.textContent = 'Playing shuffled music';
    } catch {
      this.setPlaying(false);
      this.status.textContent = 'Ready · press Play to start music';
    }
  }

  private setPlaying(playing: boolean): void {
    this.root.dataset.playing = String(playing);
    this.playButton.textContent = playing ? 'Ⅱ' : '▶';
    this.playButton.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    this.playButton.title = playing ? 'Pause music' : 'Play music';
  }
}
