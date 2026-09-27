import type { BattleEvent, BattleState } from '../../../shared/battle.mjs';
import { voiceForBattleEvent, voiceForSelection, type VoiceClip } from './VoiceRouter.mjs';

const VOICES: Record<VoiceClip, string> = {
  'gojo-selected': '/audio/voices/gojo-youre-so-right.mp3',
  'gojo-red': '/audio/voices/gojo-red-cleaned.mp3',
  'gojo-blue': '/audio/voices/gojo-maximum-output.mp3',
  'gojo-limitless': '/audio/voices/you-crying-gojo.mp3',
  'gojo-hollow-purple': '/audio/voices/gojo-hollow-purple.mp3',
  'megumi-nue': '/audio/voices/megumi-nue-screech.mp3',
  'megumi-dogs': '/audio/voices/megumi-divine-dogs.mp3',
  'megumi-treasure': '/audio/voices/megumi-with-this-treasure.mp3',
  'megumi-eight-grip': '/audio/voices/megumi-divine-general.mp3',
  'megumi-mahoraga': '/audio/voices/mahoraga-with-choir.mp3',
  'megumi-domain': '/audio/voices/megumi-oh-what-the-hell-voice.mp3',
  'toji-selected': '/audio/voices/toji-our-fight-is-just-getting-started.mp3',
  'toji-tools': '/audio/voices/toji-worm-noise-cleaned.mp3',
  'geto-selected': '/audio/voices/geto-filthy-monkeys.mp3',
  'geto-swallow': '/audio/voices/geto-heavy-swallow.mp3',
  'geto-uzumaki': '/audio/voices/geto-supreme-art-uzumaki.mp3',
  'ryu-selected': '/audio/voices/ryu-selected.mp3',
  'ryu-granite-blast': '/audio/voices/ryu-granite-blast.mp3',
  'ryu-sweet': '/audio/voices/ryu-sweet.mp3',
};

/** Small local audio bank for menu cues and character voice clips. */
export class CharacterAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<VoiceClip, AudioBuffer | null>();
  private voiceGains = new Map<VoiceClip, number>();
  private loading = new Map<VoiceClip, Promise<AudioBuffer | null>>();
  private currentVoice: AudioBufferSourceNode | null = null;
  private generation = 0;
  private lastHoverAt = 0;
  private mahoragaWarningTurn = -1;

  playSelectionVoice(characterId: string): void {
    const clip = voiceForSelection(characterId);
    if (clip) void this.playVoice(clip);
  }

  playUiCue(kind: 'hover' | 'select'): void {
    if (kind === 'hover' && performance.now() - this.lastHoverAt < 75) return;
    if (kind === 'hover') this.lastHoverAt = performance.now();
    const context = this.ensureContext();
    void context.resume().catch(() => undefined);
    if (!this.master) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === 'hover' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(kind === 'hover' ? 670 : 430, now);
    if (kind === 'select') oscillator.frequency.exponentialRampToValueAtTime(860, now + 0.075);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === 'hover' ? 0.055 : 0.1, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'hover' ? 0.045 : 0.105));
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + (kind === 'hover' ? 0.05 : 0.11));
  }

  playBattleEvent(event: BattleEvent, state: BattleState): void {
    // When the countdown reaches one, play the incantation on the last full turn before the reveal.
    const warning = event.type === 'move' && this.mahoragaWarningTurn !== state.turn &&
      state.sides.some(fighter => fighter.id === 'megumi' && fighter.summonCountdown === 1);
    const clip = voiceForBattleEvent(event);
    if (warning) {
      this.mahoragaWarningTurn = state.turn;
      void this.playVoiceSequence(clip ? ['megumi-eight-grip', clip] : ['megumi-eight-grip']);
      return;
    }
    if (clip) void this.playVoice(clip);
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  private async load(clip: VoiceClip): Promise<AudioBuffer | null> {
    if (this.buffers.has(clip)) return this.buffers.get(clip) ?? null;
    const existing = this.loading.get(clip);
    if (existing) return existing;
    const task = (async () => {
      try {
        const response = await fetch(VOICES[clip]);
        if (!response.ok) { this.buffers.set(clip, null); return null; }
        const context = this.ensureContext();
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(clip, buffer);
        this.voiceGains.set(clip, this.normalizedGain(buffer));
        return buffer;
      } catch {
        this.buffers.set(clip, null);
        return null;
      } finally {
        this.loading.delete(clip);
      }
    })();
    this.loading.set(clip, task);
    return task;
  }

  private playVoice(clip: VoiceClip): Promise<void> {
    return this.playVoiceSequence([clip]);
  }

  private async playVoiceSequence(clips: VoiceClip[]): Promise<void> {
    const token = ++this.generation;
    const context = this.ensureContext();
    await context.resume().catch(() => undefined);
    this.stopVoice();
    const playNext = async (): Promise<void> => {
      if (token !== this.generation || !this.master) return;
      const clip = clips.shift();
      if (!clip) return;
      const buffer = await this.load(clip);
      if (!buffer || token !== this.generation) { void playNext(); return; }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = this.voiceGains.get(clip) ?? 1;
      source.connect(gain);
      gain.connect(this.master!);
      this.currentVoice = source;
      source.onended = () => {
        if (this.currentVoice === source) this.currentVoice = null;
        void playNext();
      };
      source.start();
    };
    await playNext();
  }

  private stopVoice(): void {
    if (!this.currentVoice) return;
    this.currentVoice.onended = null;
    try { this.currentVoice.stop(); } catch { /* It may already have finished. */ }
    this.currentVoice = null;
  }

  private normalizedGain(buffer: AudioBuffer): number {
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    }
    return peak > 0 ? Math.min(4, 0.42 / peak) : 1;
  }
}

export const characterAudio = new CharacterAudio();
