import { SIGN_TUNING } from '../handTracking/GestureDefinitions';
import { downloadText, exportText, planMerge, type MergePlan } from '../data/DatasetMerge';
import { DatasetValidationError } from '../data/GestureDatasetImportExport';
import type { GestureDatasetManager } from '../data/GestureDatasetManager';
import type { GestureRecorder } from '../data/GestureRecorder';

/** Recordable labels shown together in the dropdown, e.g. one character's moves. */
export interface LabelGroup {
  name: string;
  labels: (string | { id: string; name: string; gestureId?: string })[];
}

/**
 * Dataset management panel: sample counts per label, recording, and
 * Export / Import / Clear. Talks only to GestureDatasetManager and
 * GestureRecorder, never to IndexedDB directly.
 */
/**
 * Optional pose library from the combined build (not the original format).
 * Its recordings are embedded in exports and merged on import.
 */
export interface LegacyPoseStore {
  export(): unknown | null;
  merge(data: unknown): { added: number; duplicates: number; overLimit: number };
  countGesture?(gestureId: string): number;
  deleteGesture?(gestureId: string): number;
}

function canonicalLabelId(label: string): string {
  const normalized=label.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'');
  if(normalized==='AMPLIFICATION_BLUE'||normalized==='BLUE')return 'LAPSE_BLUE';
  if(normalized==='SUPERNOVA')return 'CHOSO_ULTIMATE';
  return label;
}

function equivalentLabels(label: string): string[] {
  if (canonicalLabelId(label) === 'LAPSE_BLUE') return ['LAPSE_BLUE', 'AMPLIFICATION_BLUE', 'Amplification: Blue', 'BLUE'];
  if (canonicalLabelId(label) === 'CHOSO_ULTIMATE') return ['CHOSO_ULTIMATE', 'SUPERNOVA'];
  return [label];
}

export class DatasetPanel {
  private readonly events = new AbortController();
  private unsubscribe: (()=>void) | undefined;
  private countTimer: ReturnType<typeof setTimeout> | undefined;
  private selectedCount: HTMLDivElement;
  private savedCounts: Record<string, number> = {};
  private lastSession: { label: string; saved: number } | null = null;
  dispose():void {clearTimeout(this.countTimer);this.events.abort();this.unsubscribe?.();}
  private readonly manager: GestureDatasetManager;
  private readonly recorder: GestureRecorder;
  /** Labels offered for recording, in display order. */
  private labels: string[] = [];
  private readonly labelNames = new Map<string, string>();
  private readonly labelGestures = new Map<string, string>();
  private readonly counts: HTMLDivElement;
  private readonly labelSelect: HTMLSelectElement;
  private readonly recordButton: HTMLButtonElement;
  private readonly deleteButton: HTMLButtonElement;
  private readonly status: HTMLDivElement;
  private readonly importChoice: HTMLDivElement;
  private readonly fileInput: HTMLInputElement;
  private pendingImport: MergePlan | null = null;
  private readonly legacy: LegacyPoseStore | null;

  constructor(parent: HTMLElement, manager: GestureDatasetManager, recorder: GestureRecorder, groups: LabelGroup[], legacy: LegacyPoseStore | null = null) {
    this.legacy = legacy;
    this.manager = manager;
    this.recorder = recorder;

    const root = document.createElement('section');
    root.className = 'dataset-panel';
    root.innerHTML = `
      <h2>${recorder.config.continuous ? 'Hold posture & record' : 'Gesture dataset'}</h2>
      <p>${recorder.config.continuous ? 'Choose your sign, hold the posture, and press Record posture. Every new frame with detected hands is saved until you press Stop recording. Your saved instances stay in this browser.' : 'Record examples of your hand sign to train recognition.'}</p>
      <div class="dataset-row">
        <select class="dataset-label" aria-label="Label to record"></select>
        <button type="button" data-action="record"></button>
      </div>
      <div class="posture-progress" role="status" aria-live="polite"></div>
      <details class="saved-postures"><summary>Saved postures &amp; trust</summary><div class="dataset-counts"></div></details>
      <div class="dataset-row">
        <button type="button" data-action="export">Export Dataset</button>
        <button type="button" data-action="import">Import Dataset</button>
        <button type="button" data-action="delete-selected" class="danger" disabled>Delete selected move’s instances</button>
        <button type="button" data-action="clear" class="danger">Clear Dataset</button>
        <input type="file" accept="application/json,.json" hidden />
      </div>
      <div class="dataset-import-choice" hidden></div>
      <div class="dataset-status" role="status"></div>
    `;
    parent.appendChild(root);

    this.selectedCount = root.querySelector('.posture-progress')!;
    this.counts = root.querySelector('.dataset-counts')!;
    this.labelSelect = root.querySelector('.dataset-label')!;
    this.recordButton = root.querySelector('[data-action="record"]')!;
    this.deleteButton = root.querySelector('[data-action="delete-selected"]')!;
    this.status = root.querySelector('.dataset-status')!;
    this.importChoice = root.querySelector('.dataset-import-choice')!;
    this.fileInput = root.querySelector('input[type="file"]')!;

    this.setLabelGroups(groups);
    this.recordButton.textContent = this.recordLabel();
    this.labelSelect.addEventListener('change',()=>{this.updateProgress();this.syncDeleteButton();});

    this.recordButton.addEventListener('click', () => void this.record());
    this.deleteButton.addEventListener('click', () => void this.deleteSelected());
    root.querySelector('[data-action="export"]')!.addEventListener('click', () => void this.export());
    root.querySelector('[data-action="import"]')!.addEventListener('click', () => this.fileInput.click());
    root.querySelector('[data-action="clear"]')!.addEventListener('click', () => void this.clear());
    this.fileInput.addEventListener('change', () => void this.readImportFile());
    window.addEventListener('keydown', (e) => {
      if(root.closest('[hidden]')||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLElement&&e.target.closest('input,select,textarea,[contenteditable="true"]'))return;
      if ((e.key === 'r' || e.key === 'R') && !(e.target instanceof HTMLInputElement)) void this.record();
    }, {signal:this.events.signal});

    recorder.onStatus = (text) => { this.setStatus(text); this.syncRecording(); this.updateProgress(); };
    this.unsubscribe=manager.onChange(() => {
      // While recording, the live count comes from the recorder (no full recount per frame).
      if(this.countTimer!==undefined||this.recorder.busy)return;
      this.countTimer=setTimeout(()=>{this.countTimer=undefined;void this.refreshCounts();},200);
    });
  }

  /** Rebuilds the label dropdown (e.g. to put the selected character's moves first). */
  setLabelGroups(groups: LabelGroup[]): void {
    const previous = this.labelSelect.value;
    this.labelNames.clear();
    this.labelGestures.clear();
    const entries = groups.map(group => ({
      name: group.name,
      labels: group.labels.map(label => typeof label === 'string' ? { id: label, name: label } : label),
    }));
    for (const group of entries) for (const label of group.labels) {
      this.labelNames.set(label.id, label.name);
      if(label.gestureId)this.labelGestures.set(label.id,label.gestureId);
    }
    this.labels = [...new Set(entries.flatMap((g) => g.labels.map(label => label.id)))];
    this.labelSelect.replaceChildren(
      ...entries.map((g) => {
        const group = document.createElement('optgroup');
        group.label = g.name;
        for (const label of g.labels) group.appendChild(new Option(label.name, label.id));
        return group;
      }),
    );
    if (this.labels.includes(previous)) this.labelSelect.value = previous;
    this.syncDeleteButton();
    void this.refreshCounts();
  }

  async refreshCounts(): Promise<void> {
    const rawCounts = await this.manager.counts();
    const counts:Record<string,number>={};
    for(const [label,count] of Object.entries(rawCounts)){
      const id=canonicalLabelId(label);
      counts[id]=(counts[id]??0)+count;
    }
    this.savedCounts = counts;
    if (!this.recorder.sessionProgress) this.lastSession = null;
    this.updateProgress();
    this.syncDeleteButton();
    const labels = [...this.labels, ...Object.keys(counts).filter((l) => !this.labels.includes(l)).sort()];
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    this.counts.replaceChildren(
      ...labels.map((l) => row(this.labelNames.get(l) ?? l, counts[l] ?? 0, l!=='NONE'&&(counts[l]??0)>=SIGN_TUNING.learned.trustedSamples?'trusted':'')),
      row('TOTAL', total, 'total'),
    );
  }

  setStatus(text: string, isError = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', isError);
  }

  private async record(): Promise<void> {
    if (this.recorder.busy) {
      this.recorder.cancel();
      return;
    }
    this.recordButton.textContent = this.recorder.config.continuous ? 'Stop recording' : 'Cancel';
    try {
      await this.recorder.record(this.labelSelect.value);
    } catch (err) {
      this.setStatus(`Recording failed: ${String(err)}`, true);
    } finally {
      this.syncRecording();
      await this.refreshCounts();
    }
  }

  private recordLabel(): string {
    return this.recorder.config.continuous ? 'Record posture (R)' : `Record ${this.recorder.config.samplesPerBurst} (R)`;
  }

  private syncRecording(): void {
    const busy=this.recorder.busy;
    this.labelSelect.disabled=busy;
    this.recordButton.disabled=busy&&!this.recorder.recording;
    this.recordButton.textContent=busy?(this.recorder.recording?'Stop recording':'Saving…'):this.recordLabel();
    this.syncDeleteButton();
  }

  private syncDeleteButton():void{
    if(!this.deleteButton)return;
    const label=this.labelSelect.value;
    const gestureId=this.labelGestures.get(label);
    const instances=(this.savedCounts[label]??0)+(gestureId?this.legacy?.countGesture?.(gestureId)??0:0);
    this.deleteButton.disabled=this.recorder.busy||instances===0;
    this.deleteButton.textContent=instances?`Delete ${this.labelNames.get(label)??label} instances (${instances})`:'Delete selected move’s instances';
  }

  private async deleteSelected():Promise<void>{
    if(this.recorder.busy)return;
    const label=this.labelSelect.value;
    const name=this.labelNames.get(label)??label;
    const gestureId=this.labelGestures.get(label);
    const databaseCount=this.savedCounts[label]??0;
    const poseCount=gestureId?this.legacy?.countGesture?.(gestureId)??0:0;
    if(databaseCount+poseCount===0)return;
    if(!window.confirm(`Delete all ${databaseCount+poseCount} saved instance(s) of ${name}? Other moves will be kept.`))return;
    this.deleteButton.disabled=true;
    try{
      const deleted=await this.manager.deleteByLabels(equivalentLabels(label));
      const deletedPoses=gestureId?this.legacy?.deleteGesture?.(gestureId)??0:0;
      this.setStatus(`Deleted ${deleted+deletedPoses} ${name} instance(s). Other moves were kept.`);
      await this.refreshCounts();
    }catch(err){
      this.setStatus(`Could not delete ${name} instances: ${String(err)}`,true);
      await this.refreshCounts();
    }
  }

  private updateProgress(): void {
    const label=this.labelSelect.value,goal=SIGN_TUNING.learned.trustedSamples;
    // Saved total before this recording + instances saved so far in it (live, per frame).
    const session=this.recorder.sessionProgress;
    if(session)this.lastSession=session;
    else if(this.lastSession){
      // The recording just ended: keep its instances in the total until the recount lands.
      this.savedCounts={...this.savedCounts,[this.lastSession.label]:(this.savedCounts[this.lastSession.label]??0)+this.lastSession.saved};
      this.lastSession=null;
    }
    const n=(this.savedCounts[label]??0)+(session?.label===label?session.saved:0);
    const trusted=label!=='NONE'&&n>=goal;
    this.selectedCount.classList.toggle('trusted',trusted);
    const displayName=this.labelNames.get(label)??label;
    this.selectedCount.textContent=label==='NONE'?`${n} negative examples saved`:
      trusted?`${displayName} · ${n} instances · TRUSTED`:`${displayName} · ${n} / ${goal} instances · ${goal-n} more to Trusted`;
  }

  private async export(): Promise<void> {
    try {
      const samples = await this.manager.all();
      const poses = this.legacy?.export() ?? null;
      downloadText(exportText(samples, poses));
      const extra = poses ? ' (plus your pose-library recordings)' : '';
      this.setStatus(`Exported ${samples.length} samples${extra}. The file re-imports here and in the original project.`);
    } catch (err) {
      this.setStatus(`Export failed: ${String(err)}`, true);
    }
  }

  private async readImportFile(): Promise<void> {
    const file = this.fileInput.files?.[0];
    this.fileInput.value = ''; // allow re-selecting the same file later
    if (!file) return;
    let plan: MergePlan;
    try {
      if (file.size > 200_000_000) throw new DatasetValidationError('File is larger than 200 MB.');
      plan = planMerge(await file.text());
    } catch (err) {
      const why = err instanceof DatasetValidationError ? err.message : String(err);
      this.setStatus(`Import failed - "${file.name}" is not a valid dataset. ${why} Nothing was changed.`, true);
      return;
    }
    if (!plan.samples.length && !plan.legacyPoses) {
      const first = plan.rejected[0];
      this.setStatus(`Import failed - no compatible samples in "${file.name}".${first ? ` Sample #${first.index}: ${first.reason}` : ''} Nothing was changed.`, true);
      return;
    }
    this.pendingImport = plan;
    this.showImportChoice(file.name, plan);
  }

  /** Import is merge-only: existing recordings are never deleted or replaced. */
  private showImportChoice(fileName: string, plan: MergePlan): void {
    this.importChoice.replaceChildren();
    const text = document.createElement('span');
    const parts = [`${plan.samples.length} compatible samples`];
    if (plan.legacyPoses) parts.push('pose-library recordings');
    if (plan.rejected.length) parts.push(`${plan.rejected.length} invalid (not imported)`);
    text.textContent = `"${fileName}": ${parts.join(', ')}.`;
    const button = (label: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    };
    this.importChoice.append(text, button('Merge', () => void this.applyImport()), button('Cancel', () => this.hideImportChoice()));
    this.importChoice.hidden = false;
    const first = plan.rejected[0];
    this.setStatus(
      'Merge adds new samples and keeps all existing recordings; samples already saved are skipped.' +
        (first ? ` First invalid sample #${first.index}: ${first.reason}` : ''),
    );
  }

  private hideImportChoice(): void {
    this.pendingImport = null;
    this.importChoice.hidden = true;
    this.setStatus('Import cancelled. Nothing was changed.');
  }

  private async applyImport(): Promise<void> {
    const plan = this.pendingImport;
    this.importChoice.hidden = true;
    this.pendingImport = null;
    if (!plan) return;
    const notes: string[] = [];
    try {
      if (plan.samples.length) {
        const { added, skipped } = await this.manager.import(plan.samples, 'merge');
        notes.push(`Merged ${added} samples${skipped ? `, skipped ${skipped} already saved` : ''}`);
      }
      if (plan.legacyPoses) {
        if (!this.legacy) notes.push('pose-library recordings are not supported here');
        else {
          try {
            const r = this.legacy.merge(plan.legacyPoses);
            notes.push(`pose library: ${r.added} added${r.duplicates ? `, ${r.duplicates} already saved` : ''}${r.overLimit ? `, ${r.overLimit} over the per-sign limit` : ''}`);
          } catch (err) {
            notes.push(`pose library not imported (${err instanceof Error ? err.message : String(err)})`);
          }
        }
      }
      if (plan.rejected.length) notes.push(`${plan.rejected.length} invalid samples not imported`);
      this.setStatus(`${notes.join('; ')}. Existing recordings were kept.`);
      await this.refreshCounts();
    } catch (err) {
      this.setStatus(`Import failed: ${String(err)}. Existing recordings were kept.`, true);
    }
  }

  private async clear(): Promise<void> {
    if (!window.confirm('Delete ALL gesture samples stored in this browser?\n\nExported JSON files on disk are not affected.')) return;
    try {
      await this.manager.clear();
      this.setStatus('Dataset cleared.');
    } catch (err) {
      this.setStatus(`Clear failed: ${String(err)}`, true);
    }
  }
}

function row(label: string, count: number, cls = ''): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `dataset-count ${cls}`.trim();
  const name = document.createElement('span');
  name.textContent = label;
  name.title = label;
  const value = document.createElement('span');
  value.textContent = cls==='trusted'?`${count} · TRUSTED`:String(count);
  el.append(name, value);
  return el;
}
