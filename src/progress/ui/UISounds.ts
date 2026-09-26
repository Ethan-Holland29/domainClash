export type UICue = 'click' | 'fighter';

/** Short synthesized cues: a dry tap for controls, a rising chime for fighters. */
export function playUICue(context: AudioContext, cue: UICue): void {
  const notes = cue === 'fighter' ? [440, 660, 880] : [240];
  notes.forEach((frequency, i) => {
    const start = context.currentTime + i * 0.045;
    const duration = cue === 'fighter' ? 0.16 : 0.055;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = cue === 'fighter' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * (cue === 'fighter' ? 1.02 : 0.55), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(cue === 'fighter' ? 0.055 : 0.075, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  });
}

export function installUISounds(root: HTMLElement): () => void {
  let context: AudioContext | null = null;
  let disposed = false;
  const play = (cue: UICue) => {
    try {
      // Created only in response to a real interaction, respecting autoplay rules.
      context ??= new AudioContext();
      const audio = context;
      if (audio.state === 'suspended') {
        void audio.resume().then(() => { if (!disposed) playUICue(audio, cue); }).catch(() => {});
      } else if (audio.state === 'running') playUICue(audio, cue);
    } catch { /* Audio unavailable: controls must still work. */ }
  };
  const click = (event: MouseEvent) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const control = event.target.closest('button, a[href], summary, [role="button"], label.import');
    if (!control || !root.contains(control) || control.closest('[disabled], [aria-disabled="true"], [inert]')) return;
    play(control.matches('.portrait-card') ? 'fighter' : 'click');
  };
  const change = (event: Event) => {
    if (event.isTrusted && event.target instanceof HTMLSelectElement && !event.target.disabled) {
      play(event.target.matches('#character, #fight-opponent') ? 'fighter' : 'click');
    }
  };
  // Capture phase also covers controls whose handlers immediately replace the UI.
  root.addEventListener('click', click, true);
  root.addEventListener('change', change, true);
  return () => {
    disposed = true;
    root.removeEventListener('click', click, true);
    root.removeEventListener('change', change, true);
    if (context) void context.close().catch(() => {});
  };
}
