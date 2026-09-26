import { DatasetValidationError } from '../data/GestureDatasetImportExport';
import type { GestureDatasetManager } from '../data/GestureDatasetManager';
import type { GestureSample, ImportMode } from '../data/GestureDatasetTypes';
import type { GestureRecorder } from '../data/GestureRecorder';

/** Recordable labels shown together in the dropdown, e.g. one character's moves. */
export interface LabelGroup {
  name: string;
  labels: string[];
}

/**
 * Dataset management panel: sample counts per label, recording, and
 * Export / Import / Clear. Talks only to GestureDatasetManager and
 * GestureRecorder, never to IndexedDB directly.
 */
export class DatasetPanel {
  private readonly events = new AbortController();
  private unsubscribe: (()=>void) | undefined;
  dispose():void {this.events.abort();this.unsubscribe?.();}
  private readonly manager: GestureDatasetManager;
  private readonly recorder: GestureRecorder;
  /** Labels offered for recording, in display order. */
  private labels: string[] = [];
  private readonly counts: HTMLDivElement;
  private readonly labelSelect: HTMLSelectElement;
  private readonly recordButton: HTMLButtonElement;
  private readonly status: HTMLDivElement;
  private readonly importChoice: HTMLDivElement;
  private readonly fileInput: HTMLInputElement;
  private pendingImport: GestureSample[] | null = null;

  constructor(parent: HTMLElement, manager: GestureDatasetManager, recorder: GestureRecorder, groups: LabelGroup[]) {
    this.manager = manager;
    this.recorder = recorder;

    const root = document.createElement('section');
    root.className = 'dataset-panel';
    root.innerHTML = `
      <h2>Gesture dataset</h2>
      <div class="dataset-counts"></div>
      <div class="dataset-row">
        <select class="dataset-label" aria-label="Label to record"></select>
        <button type="button" data-action="record"></button>
      </div>
      <div class="dataset-row">
        <button type="button" data-action="export">Export Dataset</button>
        <button type="button" data-action="import">Import Dataset</button>
        <button type="button" data-action="clear" class="danger">Clear Dataset</button>
        <input type="file" accept="application/json,.json" hidden />
      </div>
      <div class="dataset-import-choice" hidden></div>
      <div class="dataset-status" role="status"></div>
    `;
    parent.appendChild(root);

    this.counts = root.querySelector('.dataset-counts')!;
    this.labelSelect = root.querySelector('.dataset-label')!;
    this.recordButton = root.querySelector('[data-action="record"]')!;
    this.status = root.querySelector('.dataset-status')!;
    this.importChoice = root.querySelector('.dataset-import-choice')!;
    this.fileInput = root.querySelector('input[type="file"]')!;

    this.setLabelGroups(groups);
    this.recordButton.textContent = this.recordLabel();

    this.recordButton.addEventListener('click', () => void this.record());
    root.querySelector('[data-action="export"]')!.addEventListener('click', () => void this.export());
    root.querySelector('[data-action="import"]')!.addEventListener('click', () => this.fileInput.click());
    root.querySelector('[data-action="clear"]')!.addEventListener('click', () => void this.clear());
    this.fileInput.addEventListener('change', () => void this.readImportFile());
    window.addEventListener('keydown', (e) => {
      if(root.closest('[hidden]')||e.repeat)return;
      if ((e.key === 'r' || e.key === 'R') && !(e.target instanceof HTMLInputElement)) void this.record();
    }, {signal:this.events.signal});

    recorder.onStatus = (text) => this.setStatus(text);
    this.unsubscribe=manager.onChange(() => void this.refreshCounts());
  }

  /** Rebuilds the label dropdown (e.g. to put the selected character's moves first). */
  setLabelGroups(groups: LabelGroup[]): void {
    const previous = this.labelSelect.value;
    this.labels = groups.flatMap((g) => g.labels);
    this.labelSelect.replaceChildren(
      ...groups.map((g) => {
        const group = document.createElement('optgroup');
        group.label = g.name;
        for (const label of g.labels) group.appendChild(new Option(label, label));
        return group;
      }),
    );
    if (this.labels.includes(previous)) this.labelSelect.value = previous;
    void this.refreshCounts();
  }

  async refreshCounts(): Promise<void> {
    const counts = await this.manager.counts();
    const labels = [...this.labels, ...Object.keys(counts).filter((l) => !this.labels.includes(l)).sort()];
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    this.counts.replaceChildren(
      ...labels.map((l) => row(l, counts[l] ?? 0)),
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
    this.recordButton.textContent = 'Cancel';
    try {
      await this.recorder.record(this.labelSelect.value);
    } catch (err) {
      this.setStatus(`Recording failed: ${String(err)}`, true);
    } finally {
      this.recordButton.textContent = this.recordLabel();
    }
  }

  private recordLabel(): string {
    return `Record ${this.recorder.config.samplesPerBurst} (R)`;
  }

  private async export(): Promise<void> {
    try {
      const n = await this.manager.exportToFile();
      this.setStatus(`Exported ${n} samples.`);
    } catch (err) {
      this.setStatus(`Export failed: ${String(err)}`, true);
    }
  }

  private async readImportFile(): Promise<void> {
    const file = this.fileInput.files?.[0];
    this.fileInput.value = ''; // allow re-selecting the same file later
    if (!file) return;
    try {
      this.pendingImport = this.manager.parse(await file.text());
    } catch (err) {
      const why = err instanceof DatasetValidationError ? err.message : String(err);
      this.setStatus(`Import failed - "${file.name}" is not a valid dataset. ${why}`, true);
      return;
    }
    this.showImportChoice(file.name, this.pendingImport.length);
  }

  private showImportChoice(fileName: string, count: number): void {
    this.importChoice.replaceChildren();
    const text = document.createElement('span');
    text.textContent = `Import ${count} samples from "${fileName}":`;
    const button = (label: string, onClick: () => void, cls = '') => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (cls) b.className = cls;
      b.addEventListener('click', onClick);
      return b;
    };
    this.importChoice.append(
      text,
      button('Replace current', () => void this.applyImport('replace'), 'danger'),
      button('Merge', () => void this.applyImport('merge')),
      button('Cancel', () => this.hideImportChoice()),
    );
    this.importChoice.hidden = false;
    this.setStatus('Replace deletes the current samples first. Merge keeps them and skips duplicates.');
  }

  private hideImportChoice(): void {
    this.pendingImport = null;
    this.importChoice.hidden = true;
    this.setStatus('');
  }

  private async applyImport(mode: ImportMode): Promise<void> {
    const samples = this.pendingImport;
    this.importChoice.hidden = true;
    this.pendingImport = null;
    if (!samples) return;
    try {
      const { added, skipped } = await this.manager.import(samples, mode);
      const verb = mode === 'replace' ? 'Replaced dataset with' : 'Merged';
      this.setStatus(`${verb} ${added} samples${skipped ? `, skipped ${skipped} duplicates` : ''}.`);
    } catch (err) {
      this.setStatus(`Import failed: ${String(err)}`, true);
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
  value.textContent = String(count);
  el.append(name, value);
  return el;
}
