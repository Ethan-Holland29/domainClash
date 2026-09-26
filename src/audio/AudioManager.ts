import { EffectAliases } from '../combat/MoveCatalog';
import { AbilityId } from "../combat/AbilityTypes";
import { DomainSounds } from "./DomainSounds";
import { GameConfig } from "../config/GameConfig";

type Cue = "primary" | "secondary" | "hit" | "domain" | "hurt" | "reject";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private unlocked = false;
  private muted = false;

  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = GameConfig.audio.masterVolume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.unlocked = true;
    if (GameConfig.audio.useFiles && this.buffers.size === 0) await this.tryLoadFiles();
  }

  setMuted(muted: boolean): void {
    this.muted=muted;if(muted&&typeof speechSynthesis!=="undefined")speechSynthesis.cancel();
    if (this.master) this.master.gain.value = muted ? 0 : GameConfig.audio.masterVolume;
  }

  announceClash():void {
    if(this.muted||!this.unlocked)return;
    this.play("domain");
    if(typeof speechSynthesis!=="undefined"){
      speechSynthesis.cancel();const line=new SpeechSynthesisUtterance("Domain Clash!");line.rate=.85;line.pitch=.65;line.volume=.9;speechSynthesis.speak(line);
    }
  }
  close(): void {
    if(typeof speechSynthesis!=="undefined")speechSynthesis.cancel();
    this.unlocked = false;
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  isReady(): boolean {
    return this.unlocked;
  }

  play(cue: Cue): void {
    if (!this.unlocked || !this.ctx || !this.master) return;
    const buffer = this.buffers.get(fileKey(cue));
    if (buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.master);
      src.start();
      return;
    }
    this.synthesize(cue);
  }

  playAbility(id: AbilityId): void {
    id = EffectAliases[id] ?? id;
    if (id === AbilityId.PRIMARY_ATTACK) { this.play("primary"); return; }
    if (id === AbilityId.SECONDARY_ATTACK) { this.play("secondary"); return; }
    const profile = DomainSounds[id];
    if (!profile || !this.unlocked || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    profile.notes.forEach((note,i)=>blip(this.ctx!,this.master!,now+i*profile.spacing,note,profile.duration,profile.wave,.11));
    profile.noise.forEach(t=>noiseBurst(this.ctx!,this.master!,now+t,profile.noiseDuration,.1));
  }

  private async tryLoadFiles(): Promise<void> {
    const paths = GameConfig.audio.paths;
    const jobs: Array<[string, string]> = [
      ["primary", paths.primary],
      ["secondary", paths.secondary],
      ["hit", paths.hit],
      ["domain", paths.domain],
    ];
    await Promise.all(
      jobs.map(async ([key, path]) => {
        try {
          const res = await fetch(path);
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          const decoded = await this.ctx!.decodeAudioData(buf);
          this.buffers.set(key, decoded);
        } catch {
          // Placeholder tones are used if files are missing.
        }
      }),
    );
  }

  private synthesize(cue: Cue): void {
    const ctx = this.ctx!;
    const dest = this.master!;
    const now = ctx.currentTime;

    if (cue === "primary") {
      blip(ctx, dest, now, 620, 0.09, "square", 0.18);
      blip(ctx, dest, now + 0.04, 880, 0.07, "square", 0.12);
      return;
    }
    if (cue === "secondary") {
      blip(ctx, dest, now, 180, 0.18, "sawtooth", 0.22);
      blip(ctx, dest, now + 0.05, 360, 0.16, "sawtooth", 0.16);
      blip(ctx, dest, now + 0.12, 720, 0.1, "triangle", 0.1);
      return;
    }
    if (cue === "hit") {
      noiseBurst(ctx, dest, now, 0.08, 0.22);
      blip(ctx, dest, now, 140, 0.07, "square", 0.12);
      return;
    }
    if (cue === "hurt") {
      blip(ctx, dest, now, 90, 0.16, "sawtooth", 0.18);
      return;
    }
    if (cue === "reject") {
      blip(ctx, dest, now, 220, 0.06, "square", 0.08);
      blip(ctx, dest, now + 0.07, 160, 0.08, "square", 0.08);
      return;
    }
    blip(ctx, dest, now, 110, 0.35, "sine", 0.2);
    blip(ctx, dest, now + 0.12, 165, 0.4, "sine", 0.18);
    blip(ctx, dest, now + 0.28, 220, 0.55, "triangle", 0.16);
    blip(ctx, dest, now + 0.55, 330, 0.5, "sine", 0.12);
  }
}

function fileKey(cue: Cue): string {
  if (cue === "hurt" || cue === "reject") return cue;
  return cue;
}

function blip(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

function noiseBurst(ctx: AudioContext, dest: AudioNode, when: number, dur: number, gain: number): void {
  const frames = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buffer;
  g.gain.setValueAtTime(gain, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(g);
  g.connect(dest);
  src.start(when);
}
