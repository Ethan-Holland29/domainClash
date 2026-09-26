/**
 * Placeholder sound effects, synthesised with Web Audio (original, no
 * external assets). Each can be replaced by dropping a file with the same
 * name into src/assets/audio/ (e.g. impact-heavy.mp3) - see AudioManager.
 */
export type SoundId =
  | 'primary-cast'
  | 'secondary-charge'
  | 'secondary-release'
  | 'impact-light'
  | 'impact-heavy'
  | 'blocked'
  | 'guard-up'
  | 'player-hurt'
  | 'opponent-windup'
  | 'domain-ready'
  | 'domain-cast'
  | 'domain-collapse'
  | 'on-cooldown'
  | 'not-ready'
  | 'victory'
  | 'defeat';

export const SOUND_IDS: SoundId[] = [
  'primary-cast',
  'secondary-charge',
  'secondary-release',
  'impact-light',
  'impact-heavy',
  'blocked',
  'guard-up',
  'player-hurt',
  'opponent-windup',
  'domain-ready',
  'domain-cast',
  'domain-collapse',
  'on-cooldown',
  'not-ready',
  'victory',
  'defeat',
];

type Synth = (ctx: AudioContext, out: AudioNode) => void;

let noiseBuffer: AudioBuffer | null = null;

function noise(ctx: AudioContext): AudioBufferSourceNode {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

/** Gain node with an attack/decay envelope starting now. */
function envelope(ctx: AudioContext, out: AudioNode, peak: number, attack: number, decay: number, delay = 0): GainNode {
  const g = ctx.createGain();
  const t = ctx.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function tone(
  ctx: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  from: number,
  to: number,
  peak: number,
  attack: number,
  decay: number,
  delay = 0,
): void {
  const o = ctx.createOscillator();
  const t = ctx.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + attack + decay);
  o.connect(envelope(ctx, out, peak, attack, decay, delay));
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

/** Filtered noise sweep: whooshes, slashes, rumbles. */
function whoosh(
  ctx: AudioContext,
  out: AudioNode,
  filter: BiquadFilterType,
  from: number,
  to: number,
  peak: number,
  attack: number,
  decay: number,
  delay = 0,
): void {
  const src = noise(ctx);
  const f = ctx.createBiquadFilter();
  const t = ctx.currentTime + delay;
  f.type = filter;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  src.connect(f);
  f.connect(envelope(ctx, out, peak, attack, decay, delay));
  src.start(t);
  src.stop(t + attack + decay + 0.05);
}

export const SYNTHS: Record<SoundId, Synth> = {
  'primary-cast': (c, o) => whoosh(c, o, 'bandpass', 1800, 5200, 0.5, 0.01, 0.16),
  'secondary-charge': (c, o) => {
    tone(c, o, 'sawtooth', 90, 420, 0.12, 0.55, 0.15);
    whoosh(c, o, 'lowpass', 300, 2400, 0.25, 0.6, 0.1);
  },
  'secondary-release': (c, o) => {
    whoosh(c, o, 'bandpass', 5000, 900, 0.7, 0.005, 0.3);
    tone(c, o, 'square', 520, 120, 0.12, 0.005, 0.25);
  },
  'impact-light': (c, o) => {
    whoosh(c, o, 'lowpass', 3000, 400, 0.6, 0.002, 0.12);
    tone(c, o, 'sine', 180, 60, 0.5, 0.002, 0.14);
  },
  'impact-heavy': (c, o) => {
    whoosh(c, o, 'lowpass', 2500, 120, 0.9, 0.003, 0.45);
    tone(c, o, 'sine', 120, 35, 0.9, 0.003, 0.5);
    tone(c, o, 'triangle', 60, 30, 0.5, 0.01, 0.6);
  },
  blocked: (c, o) => {
    tone(c, o, 'square', 1400, 1300, 0.12, 0.002, 0.25);
    tone(c, o, 'square', 2100, 1900, 0.08, 0.002, 0.3);
    whoosh(c, o, 'highpass', 4000, 6000, 0.25, 0.002, 0.08);
  },
  'guard-up': (c, o) => tone(c, o, 'triangle', 300, 600, 0.12, 0.02, 0.15),
  'player-hurt': (c, o) => {
    whoosh(c, o, 'lowpass', 1200, 200, 0.7, 0.003, 0.25);
    tone(c, o, 'sawtooth', 220, 90, 0.2, 0.003, 0.3);
  },
  'opponent-windup': (c, o) => {
    tone(c, o, 'sawtooth', 70, 55, 0.18, 0.1, 0.6);
    whoosh(c, o, 'lowpass', 200, 500, 0.2, 0.3, 0.4);
  },
  'domain-ready': (c, o) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, o, 'triangle', f, f, 0.18, 0.01, 0.35, i * 0.08));
  },
  'domain-cast': (c, o) => {
    tone(c, o, 'sine', 55, 40, 0.8, 0.05, 1.6);
    tone(c, o, 'sawtooth', 110, 220, 0.12, 0.8, 0.8);
    whoosh(c, o, 'lowpass', 200, 3000, 0.4, 0.9, 0.8);
  },
  'domain-collapse': (c, o) => {
    tone(c, o, 'sine', 330, 80, 0.3, 0.02, 0.9);
    whoosh(c, o, 'lowpass', 3000, 150, 0.35, 0.02, 0.8);
  },
  'on-cooldown': (c, o) => tone(c, o, 'sine', 440, 330, 0.12, 0.005, 0.1),
  'not-ready': (c, o) => {
    tone(c, o, 'square', 160, 150, 0.1, 0.005, 0.12);
    tone(c, o, 'square', 120, 110, 0.1, 0.005, 0.18, 0.13);
  },
  victory: (c, o) => {
    [392, 523, 659, 784].forEach((f, i) => tone(c, o, 'triangle', f, f, 0.2, 0.01, 0.5, i * 0.12));
  },
  defeat: (c, o) => {
    [392, 330, 262, 196].forEach((f, i) => tone(c, o, 'sine', f, f * 0.98, 0.2, 0.01, 0.55, i * 0.18));
  },
};
