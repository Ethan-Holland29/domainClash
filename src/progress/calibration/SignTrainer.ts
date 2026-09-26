import { ALL_GESTURES, GESTURE_LABELS, type GestureType } from '../handTracking/GestureTypes';
import type { TrackedHand } from '../handTracking/HandTypes';
import { PoseLibrary, describe, distance, type Pose } from './PoseLibrary';

import { PREPARE_MS, MOVEMENT_GRACE_MS, palmsStable } from './RecordingStability';

import { createSample } from '../../signs/data/GestureSampleFactory';
import { DEFAULT_RECORDER_CONFIG } from '../../signs/data/GestureRecorder';
import type { GestureSample } from '../../signs/data/GestureDatasetTypes';
import { mainFrame, signDefinition } from '../handTracking/MainSigns';

export class SignTrainer {
  private allowed: GestureType[] = ALL_GESTURES;
  private select: HTMLSelectElement;
  private status: HTMLElement;
  private button: HTMLButtonElement;
  private samples: Pose[] = [];
  private draft: GestureSample[] = [];
  private rawSamples: GestureSample[] = [];
  private started = 0;
  private palmReference: TrackedHand[] | null = null;
  private movementSince: number | null = null;
  private lastSample = 0;
  private recording = false;
  private save: HTMLButtonElement;
  private add: HTMLButtonElement;
  get active(): boolean { return this.recording || this.draft.length > 0; }
  private library: PoseLibrary;
  constructor(container: HTMLElement, library: PoseLibrary) {
    this.library = library;
    container.innerHTML = `<h1>Teach DomainClash your signs</h1><p>Choose a move and demonstrate the sign you want it to use. Keep the same hand count and hold still. You get 5 seconds to prepare, then 100 camera samples (about 10 seconds).</p>
    <label>Move <select id="move">${ALL_GESTURES.map(g => `<option value="${g}">${GESTURE_LABELS[g]}</option>`).join('')}</select></label>
    <div class="actions"><button id="record" disabled>Record this sign</button><button id="add-example" disabled>Save as another example</button><button id="save" disabled>Replace examples & next</button><button id="cancel">Cancel / discard</button><button id="export">Export backup</button><label class="import">Import backup <input id="import" type="file" accept="application/json"></label></div>
    <p id="training-status" role="status"></p><p>Saved signs stay in this browser. Only hand landmark numbers are stored, never webcam video. Export a backup to keep a file. You can also import a gesture dataset exported from domainClash-main. Built-in signs stay available. Moves marked “record first” need at least 20 samples; use distinct poses for each move.</p>`;
    this.select = container.querySelector('#move')!;
    this.status = container.querySelector('#training-status')!;
    this.button = container.querySelector('#record')!;
    this.add = container.querySelector("#add-example")!;
    this.save = container.querySelector('#save')!;
    this.status.textContent = library.warning || `${Object.keys(library.data).length} of ${ALL_GESTURES.length} signs saved. Start with BASIC PUNCH.`;
    this.button.onclick = () => { this.samples = []; this.rawSamples = []; this.draft = []; this.palmReference = null; this.movementSince = null; this.save.disabled = true; this.add.disabled = true; this.started = performance.now(); this.lastSample = 0; this.recording = true; this.select.disabled = true; };
    container.querySelector<HTMLButtonElement>('#cancel')!.onclick = () => this.cancel('Capture discarded. Your saved signs are unchanged.');
    this.add.onclick = async () => {
      const gesture = this.select.value as GestureType;
      try {
        this.save.disabled = this.add.disabled = true;
        await this.library.saveSamples(gesture, this.draft, true);
        const count = this.library.count(gesture);
        this.cancel(`Example added for ${GESTURE_LABELS[gesture]}. ${count} saved samples total. Record another slight variation, or test this sign.`);
        this.refreshLabels();
      } catch (error) { this.status.textContent = error instanceof Error ? error.message : 'Could not save this example.'; this.save.disabled = this.add.disabled = !this.draft.length; }
    };
    this.save.onclick = async () => {
      try {
        this.save.disabled = this.add.disabled = true;
        await this.library.saveSamples(this.select.value as GestureType, this.draft, false);
        const next = this.allowed.find(g => !this.library.count(g));
        this.cancel(next ? `Saved. Next: ${GESTURE_LABELS[next]}. Show your preferred sign, then record.` : 'All signs for this character are saved. Try them in the camera or choose another character.');
        this.refreshLabels();
        if (next) this.select.value = next;
      } catch { this.status.textContent = 'Could not save to browser storage. Free space or allow site storage, then try Save again.'; this.save.disabled = this.add.disabled = !this.draft.length; }
    };
    container.querySelector<HTMLButtonElement>('#export')!.onclick = async () => {
      try { await library.exportBackup(); } catch { this.status.textContent = 'Could not export signs. Please try again.'; }
    };
    container.querySelector<HTMLInputElement>('#import')!.onchange = async e => {
      const input = e.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
      try { if (file.size > 10_000_000) throw new Error(); await library.importBackup(await file.text()); this.cancel('Backup imported. Matching saved moves were replaced.'); this.refreshLabels(); }
      catch { this.status.textContent = 'Import failed: invalid backup or browser storage unavailable.'; }
      input.value = '';
    };
  }
  setMoves(moves: GestureType[]): void {
    this.allowed = moves;
    this.cancel('Character selected. Built-in and trained signs are ready. Record moves marked “record first” to enable their hand signs.');
    this.refreshLabels();
  }
  private refreshLabels(): void {
    const selected = this.select.value;
    this.select.innerHTML = this.allowed.map(g => `<option value="${g}">${GESTURE_LABELS[g]} — ${this.library.count(g) ? `${this.library.count(g)} saved samples` : this.library.available(g) ? 'ready' : 'record first'}</option>`).join('');
    if (this.allowed.includes(selected as GestureType)) this.select.value = selected;
  }
  ready(): void { this.button.disabled = false; }
  cameraStopped(): void { this.cancel('Enable camera to record signs.'); this.button.disabled = true; }
  private cancel(message: string): void { this.recording = false; this.draft = []; this.samples = []; this.rawSamples = []; this.select.disabled = false; this.save.disabled = true; this.add.disabled = true; this.status.textContent = message; }
  update(hands: TrackedHand[], now: number, aspect: number): void {
    if (!this.recording) return;
    const elapsed = now - this.started;
    if (elapsed < PREPARE_MS) { this.status.textContent = `Show ${GESTURE_LABELS[this.select.value as GestureType]} — starting in ${Math.ceil((PREPARE_MS - elapsed) / 1000)}…`; return; }
    const pose = describe(hands, aspect);
    if (!pose || (this.palmReference && !palmsStable(hands, this.palmReference, aspect))) {
      this.movementSince ??= now;
      if (now - this.movementSince >= MOVEMENT_GRACE_MS) {
        this.cancel('Palm tracking changed or hands moved out of view. Keep your palms steady and record again.');
      } else this.status.textContent = 'Waiting for steady palm tracking…';
      return;
    }
    this.movementSince = null;
    this.palmReference ??= structuredClone(hands);
    if (now - this.lastSample >= DEFAULT_RECORDER_CONFIG.intervalMs) {
      this.samples.push(pose);
      this.rawSamples.push(createSample(signDefinition(this.select.value as GestureType).datasetLabel, mainFrame(hands, now, aspect), []));
      this.lastSample = now;
    }
    this.status.textContent = `Capturing ${hands.length} hand(s)… ${this.samples.length}/${DEFAULT_RECORDER_CONFIG.samplesPerBurst} samples`;
    if (this.samples.length < DEFAULT_RECORDER_CONFIG.samplesPerBurst) {
      if (elapsed > PREPARE_MS + 30000) this.cancel('Capture was too slow. Close other camera tabs and try again.');
      return;
    }
    this.recording = false;
    if (this.samples.length < 20) { this.cancel('At least 20 camera samples are needed. Please record again.'); return; }
    const conflict = this.allowed.find(g => g !== this.select.value && this.library.data[g]?.some(p => this.samples.some(s => distance(p, s) < 0.16)));
    if (conflict) { this.cancel(`This looks too similar to ${GESTURE_LABELS[conflict]}. Use a more distinct sign and record again.`); return; }
    this.draft = this.rawSamples;
    this.save.disabled = false;
    this.add.disabled = false;
    this.status.textContent = `Captured ${GESTURE_LABELS[this.select.value as GestureType]} with ${hands.length} hand(s). If this was your intended sign, choose Save as another example to keep your previous recordings, or Replace examples & next to replace them.`;
  }
}
