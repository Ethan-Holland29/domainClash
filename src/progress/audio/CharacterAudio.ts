import type { BattleEvent, BattleState } from '../../../shared/battle.mjs';
import { voiceForBattleEvent, voiceForSelection, type VoiceClip } from './VoiceRouter.mjs';
import { sfxForBattleEvent, type BattleSfx } from './BattleSfxRouter.mjs';

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
  'sukuna-selected': '/audio/voices/sukuna-contest-of-firepower.mp3',
  'sukuna-domain': '/audio/voices/sukuna-domain-expansion.mp3',
  'choso-selected': '/audio/voices/choso-yuuujiiii.mp3',
  'choso-piercing-blood': '/audio/voices/choso-piercing-blood.mp3',
  'choso-supernova': '/audio/voices/choso-supernova.mp3',
  'megumi-selected': '/audio/voices/megumi-help-me.mp3',
  'yuji-selected': '/audio/voices/yuji-jennifer-lawrence.mp3',
  'yuji-straight-hands': '/audio/voices/yuji-ill-just-kill-you.mp3',
  'yuji-black-flash': '/audio/voices/yuji-black-flash.mp3',
  'yuta-selected': '/audio/voices/yuta-come-to-me-rika.mp3',
  'yuta-rika': '/audio/voices/yuta-lend-me-your-strength.mp3',
};
const SFX: Record<BattleSfx, string> = {
  'shield-block': '/audio/sfx/shield-block.mp3',
  'sword-slashes': '/audio/sfx/sword-slashes.mp3',
  'punch-1': '/audio/sfx/punch-1.mp3',
  'punch-2': '/audio/sfx/punch-2.mp3',
  'punch-3': '/audio/sfx/punch-3.mp3',
  'punch-4': '/audio/sfx/punch-4.mp3',
  'cursed-fists-fire': '/audio/sfx/cursed-fists-fire.mp3',
};

/** Small local audio bank for menu cues and character voice clips. */
export class CharacterAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<VoiceClip, AudioBuffer | null>();
  private voiceGains = new Map<VoiceClip, number>();
  private loading = new Map<VoiceClip, Promise<AudioBuffer | null>>();
  private sfxBuffers = new Map<BattleSfx, AudioBuffer | null>();
  private sfxLoading = new Map<BattleSfx, Promise<AudioBuffer | null>>();
  private voiceQueue: { clips: VoiceClip[]; summonSequence: boolean; selection: boolean }[] = [];
  private voiceQueueRunning = false;
  private lastHoverAt = 0;
  private summonSequenceActive = false;
  onVoiceSequence: (active: boolean) => void = () => {};

  playSelectionVoice(characterId: string): void {
    const clip = voiceForSelection(characterId);
    if (clip) this.enqueueVoice([clip], false, true);
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

  playBattleEvent(event: BattleEvent, _state: BattleState): void {
    const sounds = sfxForBattleEvent(event);
    if (sounds.length) void this.playSfxSequence(sounds);
    // Play the complete Mahoraga incantation as one sequence on the takeover turn.
    const takeover = event.type === 'mahoraga' && /takes over/i.test(event.text);
    if (takeover) {
      this.enqueueVoice(['megumi-treasure', 'megumi-eight-grip', 'megumi-mahoraga'], true, false);
      return;
    }
    if (this.summonSequenceActive) return;
    const clip = voiceForBattleEvent(event);
    if (clip) this.enqueueVoice([clip], false, false);
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

  private async loadSfx(clip: BattleSfx): Promise<AudioBuffer | null> {
    if (this.sfxBuffers.has(clip)) return this.sfxBuffers.get(clip) ?? null;
    const existing = this.sfxLoading.get(clip);
    if (existing) return existing;
    const task = (async () => {
      try {
        const response = await fetch(SFX[clip]);
        if (!response.ok) { this.sfxBuffers.set(clip, null); return null; }
        const buffer = await this.ensureContext().decodeAudioData(await response.arrayBuffer());
        this.sfxBuffers.set(clip, buffer);
        return buffer;
      } catch {
        this.sfxBuffers.set(clip, null);
        return null;
      } finally { this.sfxLoading.delete(clip); }
    })();
    this.sfxLoading.set(clip, task);
    return task;
  }

  private async playSfxSequence(clips: BattleSfx[]): Promise<void> {
    const context = this.ensureContext();
    await context.resume().catch(() => undefined);
    const buffers = await Promise.all(clips.map(clip => this.loadSfx(clip)));
    if (!this.master) return;
    // Yuji's four-hit ultimate is a flurry: layer the first three hits closely,
    // then land the fourth hit as a distinct finisher.
    let offset = 0;
    const now = context.currentTime + 0.01;
    for (let i = 0; i < clips.length; i++) {
      const buffer = buffers[i];
      if (!buffer) continue;
      const source = context.createBufferSource(); source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = Math.min(1, this.normalizedGain(buffer, clips.length > 1 ? 0.25 : 0.36));
      source.connect(gain); gain.connect(this.master);
      source.start(now + offset);
      offset += clips.length > 1 ? (i === 2 ? 0.42 : 0.085) : 0;
    }
  }

  private enqueueVoice(clips: VoiceClip[], summonSequence: boolean, selection: boolean): void {
    // Let the clip already playing finish. Replace stale queued selection
    // previews so rapidly browsing fighters does not create a long backlog.
    if (selection) this.voiceQueue = this.voiceQueue.filter(job => !job.selection);
    if (summonSequence) this.summonSequenceActive = true;
    this.voiceQueue.push({ clips, summonSequence, selection });
    void this.drainVoiceQueue();
  }

  private async drainVoiceQueue(): Promise<void> {
    if (this.voiceQueueRunning) return;
    this.voiceQueueRunning = true;
    try {
      while (this.voiceQueue.length) {
        const job = this.voiceQueue.shift()!;
        if (job.summonSequence) this.onVoiceSequence(true);
        for (const clip of job.clips) await this.playVoiceBuffer(clip);
        if (job.summonSequence) {
          this.summonSequenceActive = false;
          this.onVoiceSequence(false);
        }
      }
    } finally {
      this.voiceQueueRunning = false;
      if (this.voiceQueue.length) void this.drainVoiceQueue();
    }
  }

  private async playVoiceBuffer(clip: VoiceClip): Promise<void> {
    const context = this.ensureContext();
    await context.resume().catch(() => undefined);
    const buffer = await this.load(clip);
    if (!buffer || !this.master) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = this.voiceGains.get(clip) ?? 1;
    source.connect(gain);
    gain.connect(this.master);
    await new Promise<void>(resolve => {
      source.onended = () => resolve();
      source.start();
    });
  }

  private normalizedGain(buffer: AudioBuffer, target = 0.42): number {
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    }
    return peak > 0 ? Math.min(4, target / peak) : 1;
  }
}

export const characterAudio = new CharacterAudio();
