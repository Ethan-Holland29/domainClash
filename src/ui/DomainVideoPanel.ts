import type { DomainVideoInfo, DomainVideoStore } from '../data/DomainVideoStore';

/** One domain that can have a video. */
export interface DomainVideoSlot {
  domainId: string;
  domainName: string;
  characterName: string;
  color: string;
  /** URL of a video bundled in src/assets/domains/, used when nothing is uploaded. */
  bundledUrl: string | null;
}

/**
 * "Domain Expansion videos" panel: one drop area per domain. Choose or drag
 * an mp4 onto a row to use it for that domain; Preview plays it; Remove
 * deletes it from the browser.
 */
export class DomainVideoPanel {
  private readonly store: DomainVideoStore;
  private readonly slots: DomainVideoSlot[];
  private readonly list: HTMLDivElement;
  private readonly status: HTMLDivElement;
  /** Plays a video URL the same way a real Domain Expansion does. */
  onPreview: ((url: string) => Promise<void>) | null = null;
  /** Called after a video is added, replaced or removed. */
  onChange: (() => void) | null = null;

  constructor(parent: HTMLElement, store: DomainVideoStore, slots: DomainVideoSlot[]) {
    this.store = store;
    this.slots = slots;
    const root = document.createElement('section');
    root.className = 'video-panel';
    const title = document.createElement('h2');
    title.textContent = 'Domain Expansion videos';
    const hint = document.createElement('p');
    hint.className = 'video-hint';
    hint.textContent = 'Drop an mp4 onto a domain (or click Choose file). It plays when that Domain Expansion fires. Saved in this browser only.';
    this.list = document.createElement('div');
    this.list.className = 'video-rows';
    this.status = document.createElement('div');
    this.status.className = 'video-status';
    this.status.setAttribute('role', 'status');
    root.append(title, hint, this.list, this.status);
    parent.appendChild(root);
  }

  async refresh(): Promise<void> {
    const stored = new Map((await this.store.list()).map((v) => [v.domainId, v]));
    this.list.replaceChildren(...this.slots.map((slot) => this.row(slot, stored.get(slot.domainId) ?? null)));
  }

  private row(slot: DomainVideoSlot, video: DomainVideoInfo | null): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'video-row';
    row.style.setProperty('--char-color', slot.color);

    const name = document.createElement('div');
    name.className = 'video-domain';
    const who = document.createElement('span');
    who.className = 'video-character';
    who.textContent = slot.characterName;
    const domain = document.createElement('span');
    domain.textContent = slot.domainName;
    name.append(who, domain);

    const file = document.createElement('div');
    file.className = 'video-file';
    file.textContent = video
      ? `${video.fileName} · ${formatSize(video.size)}`
      : slot.bundledUrl
        ? 'Using bundled file from src/assets/domains/'
        : 'No video - drop an mp4 here';
    file.classList.toggle('empty', !video && !slot.bundledUrl);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/webm,video/quicktime,video/*';
    input.hidden = true;
    input.addEventListener('change', () => {
      const chosen = input.files?.[0];
      input.value = '';
      if (chosen) void this.save(slot, chosen);
    });

    const actions = document.createElement('div');
    actions.className = 'video-actions';
    actions.append(
      button(video ? 'Replace' : 'Choose file', () => input.click()),
      button('Preview', () => void this.preview(slot), !video && !slot.bundledUrl),
      button('Remove', () => void this.remove(slot), !video, 'danger'),
      input,
    );
    row.append(name, file, actions);

    // Drag & drop a video file onto the row.
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('dragging');
    });
    row.addEventListener('dragleave', () => row.classList.remove('dragging'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('dragging');
      const dropped = e.dataTransfer?.files?.[0];
      if (dropped) void this.save(slot, dropped);
    });
    return row;
  }

  private async save(slot: DomainVideoSlot, file: File): Promise<void> {
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
      this.setStatus(`"${file.name}" is not a video file.`, true);
      return;
    }
    this.setStatus(`Saving ${file.name}...`);
    try {
      await this.store.save(slot.domainId, file);
      await this.refresh();
      this.onChange?.();
      this.setStatus(`${slot.domainName} will now play "${file.name}".`);
    } catch (err) {
      this.setStatus(`Could not save the video (browser storage full?): ${String(err)}`, true);
    }
  }

  private async remove(slot: DomainVideoSlot): Promise<void> {
    await this.store.remove(slot.domainId);
    await this.refresh();
    this.onChange?.();
    this.setStatus(`Removed the video for ${slot.domainName}.`);
  }

  private async preview(slot: DomainVideoSlot): Promise<void> {
    const blob = await this.store.get(slot.domainId);
    const url = blob ? URL.createObjectURL(blob) : slot.bundledUrl;
    if (!url || !this.onPreview) return;
    try {
      await this.onPreview(url);
    } finally {
      if (blob) URL.revokeObjectURL(url);
    }
  }

  private setStatus(text: string, isError = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', isError);
  }
}

function button(label: string, onClick: () => void, disabled = false, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.disabled = disabled;
  if (cls) b.className = cls;
  b.addEventListener('click', onClick);
  return b;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
