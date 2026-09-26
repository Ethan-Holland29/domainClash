import { CHARACTERS } from '../characters/Characters';
import { characterGestures } from '../characters/CharacterTypes';
import { ALL_GESTURES, GESTURE_LABELS, type GestureType, type GestureRecognitionState } from '../handTracking/GestureTypes';
import { GestureRecognizer } from '../handTracking/GestureRecognizer';
import type { TrackedHand } from '../handTracking/HandTypes';
import type { PoseLibrary } from './PoseLibrary';

interface Trial { gesture: GestureType; character: string; result: 'pending' | 'missing' | 'passed' | 'skipped'; wrong: string[]; attempts: number; }
export class RecognitionDemo {
  private trials: Trial[] = [];
  private index = 0;
  private phase: 'idle' | 'release' | 'prepare' | 'show' | 'passed' | 'finished' = 'idle';
  private since = 0;
  private clearSince = 0;
  private aspect = 4 / 3;
  private cameraReady = false;
  private startedAt = '';
  private status: HTMLElement;
  private results: HTMLElement;
  private start: HTMLButtonElement;
  private next: HTMLButtonElement;
  private retry: HTMLButtonElement;
  private recognizer: GestureRecognizer;
  private setLocked: (locked: boolean) => void;
  get active(): boolean { return this.phase !== 'idle' && this.phase !== 'finished'; }
  constructor(container: HTMLElement, library: PoseLibrary, setLocked: (locked: boolean) => void) {
    this.setLocked = setLocked;
    container.innerHTML = `<h2>Test every sign</h2><p>Each saved sign is tested against its character’s full move set. Lower your hands between trials, then hold the prompted sign. Basic Punch is tested once. This does not change your recordings.</p><div class="actions"><button id="demo-start" disabled>Start sign demo</button><button id="demo-next" disabled>Skip sign</button><button id="demo-retry" disabled>Retry sign</button><button id="demo-stop">Stop demo</button><button id="demo-export">Export test report</button></div><p id="demo-status" role="status">Waiting for camera. Missing recordings will be listed separately.</p><ul id="demo-results"></ul>`;
    this.status = container.querySelector('#demo-status')!;
    this.results = container.querySelector('#demo-results')!;
    this.start = container.querySelector('#demo-start')!;
    this.next = container.querySelector('#demo-next')!;
    this.retry = container.querySelector('#demo-retry')!;
    this.recognizer = new GestureRecognizer(hands => {
      const character = CHARACTERS.find(c => c.id === this.trials[this.index]?.character);
      return library.evaluate(hands, this.aspect, character ? characterGestures(character) : []);
    });
    this.start.onclick = () => {
      this.startedAt = new Date().toISOString();
      this.trials = ALL_GESTURES.map(gesture => ({ gesture, character: CHARACTERS.find(c => characterGestures(c).includes(gesture))!.id, result: library.available(gesture) ? 'pending' : 'missing', wrong: [], attempts: 0 }));
      this.index = -1; this.setLocked(true); this.start.disabled = true; this.advance();
    };
    this.next.onclick = () => { const trial = this.trials[this.index]; if (trial.result !== 'passed') trial.result = 'skipped'; this.advance(); };
    this.retry.onclick = () => { this.trials[this.index].result = 'pending'; this.begin(); };
    container.querySelector<HTMLButtonElement>('#demo-stop')!.onclick = () => this.finish('Demo stopped. Pending signs have not been tested.');
    container.querySelector<HTMLButtonElement>('#demo-export')!.onclick = () => {
      const data = { startedAt: this.startedAt, exportedAt: new Date().toISOString(), trials: this.trials };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'domainclash-recognition-report.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
  ready(): void { this.cameraReady = true; this.start.disabled = false; this.status.textContent = 'Camera ready. Choose Start sign demo when you’re ready.'; }
  cameraStopped(): void { this.cameraReady = false; this.finish('Enable camera to test signs.'); }
  private render(): void {
    this.results.replaceChildren(...this.trials.map(t => {
      const li = document.createElement('li');
      li.textContent = `${GESTURE_LABELS[t.gesture]}: ${t.result === 'missing' ? 'not recorded' : t.result}${t.wrong.length ? ` — also recognized as ${t.wrong.join(', ')}` : ''}`;
      return li;
    }));
  }
  private advance(): void {
    do { this.index++; } while (this.index < this.trials.length && this.trials[this.index].result === 'missing');
    if (this.index === this.trials.length) { this.finish('Demo complete. Review the results below and export the report so we can inspect any misses.'); return; }
    this.begin();
  }
  private begin(): void {
    this.phase = 'release'; this.clearSince = 0;
    this.trials[this.index].attempts++;
    this.recognizer.suspend();
    this.next.disabled = false; this.retry.disabled = false; this.next.textContent = 'Skip sign';
    this.status.textContent = 'Lower both hands out of view to begin the next trial.';
    this.render();
  }
  private finish(message: string): void {
    this.phase = 'finished'; this.setLocked(false); this.start.disabled = !this.cameraReady; this.next.disabled = true; this.retry.disabled = true;
    this.status.textContent = message; this.render();
  }
  update(hands: TrackedHand[], now: number, aspect: number): GestureRecognitionState | null {
    if (!this.active) return null;
    this.aspect = aspect;
    const trial = this.trials[this.index];
    const label = GESTURE_LABELS[trial.gesture];
    const character = CHARACTERS.find(c => c.id === trial.character)!;
    if (this.phase === 'release') {
      if (hands.length) this.clearSince = 0;
      else if (!this.clearSince) this.clearSince = now;
      else if (now - this.clearSince >= 500) { this.phase = 'prepare'; this.since = now; }
      return this.recognizer.update([], now);
    }
    if (this.phase === 'prepare') {
      this.status.textContent = `${character.name} — ${label}. Get ready: ${Math.max(1, Math.ceil((3000 - (now - this.since)) / 1000))}…`;
      if (now - this.since >= 3000) { this.phase = 'show'; this.since = now; }
      return this.recognizer.update([], now);
    }
    if (this.phase === 'passed') return this.recognizer.getState();
    const state = this.recognizer.update(hands, now);
    if (state.confirmedGesture === trial.gesture) {
      trial.result = 'passed'; this.phase = 'passed'; this.next.textContent = 'Next sign';
      this.status.textContent = `Recognized ${label}! Choose Next sign, or Retry sign to check it again.`; this.render();
    } else {
      if (state.confirmedGesture) {
        const wrong = GESTURE_LABELS[state.confirmedGesture];
        if (!trial.wrong.includes(wrong)) { trial.wrong.push(wrong); this.render(); }
      }
      const candidate = state.confirmedGesture ?? state.candidateGesture;
      this.status.textContent = `Show ${label} (${character.name}). ${hands.length ? `${hands.length} hand(s) detected.` : 'No hands detected.'} ${candidate ? `Recognizing ${GESTURE_LABELS[candidate]}: ${Math.round(state.holdProgress * 100)}%.` : 'No matching sign yet.'}${now - this.since > 12000 ? ' Try adjusting your angle, or skip this sign to flag it for review.' : ''}`;
    }
    return state;
  }
}
