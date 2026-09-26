import { countByLabel, downloadDataset, loadBundledDataset, parseDataset } from './GestureDatasetImportExport';
import { GestureDatasetStore } from './GestureDatasetStore';
import type { GestureSample, ImportMode } from './GestureDatasetTypes';

/** Set once the user clears the dataset, so the bundled default is not re-seeded behind their back. */
const META_CLEARED_BY_USER = 'clearedByUser';

export interface DatasetStartupInfo {
  /** Samples loaded from IndexedDB at startup. */
  storedCount: number;
  /** Samples seeded from data/gesture-dataset.json (only when IndexedDB was empty). */
  seededFromBundle: number;
  /** Whether the browser granted persistent (non-evictable) storage. */
  persistent: boolean | null;
}

/**
 * High-level dataset operations for the UI: startup loading, counts,
 * import/export and clearing. Storage details stay in GestureDatasetStore.
 */
export class GestureDatasetManager {
  private readonly store: GestureDatasetStore;
  private readonly changeListeners = new Set<() => void>();

  private constructor(store: GestureDatasetStore) {
    this.store = store;
  }

  static async create(): Promise<{ manager: GestureDatasetManager; startup: DatasetStartupInfo }> {
    const store = await GestureDatasetStore.open();
    const manager = new GestureDatasetManager(store);
    const persistent = await requestPersistentStorage();

    const storedCount = await store.count();
    let seededFromBundle = 0;
    if (storedCount === 0 && !(await store.getMeta<boolean>(META_CLEARED_BY_USER))) {
      try {
        const bundled = await loadBundledDataset();
        if (bundled && bundled.length > 0) {
          await store.replaceAll(bundled);
          seededFromBundle = bundled.length;
        }
      } catch (err) {
        console.warn('Bundled dataset data/gesture-dataset.json is invalid and was ignored:', err);
      }
    }
    return { manager, startup: { storedCount, seededFromBundle, persistent } };
  }

  /** Called after any change (record, import, clear). Returns an unsubscribe function. */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  async add(sample: GestureSample): Promise<void> {
    await this.store.add(sample);
    this.changed();
  }

  async all(): Promise<GestureSample[]> {
    return this.store.getAll();
  }

  async counts(): Promise<Record<string, number>> {
    return countByLabel(await this.store.getAll());
  }

  async exportToFile(): Promise<number> {
    const samples = await this.store.getAll();
    downloadDataset(samples);
    return samples.length;
  }

  /** Validates dataset JSON text. Throws DatasetValidationError on bad input. */
  parse(text: string): GestureSample[] {
    return parseDataset(text);
  }

  async import(samples: GestureSample[], mode: ImportMode): Promise<{ added: number; skipped: number }> {
    const unique = dedupe(samples);
    const duplicatesInFile = samples.length - unique.length;
    let added = unique.length;
    let skipped = duplicatesInFile;
    if (mode === 'replace') {
      await this.store.replaceAll(unique);
    } else {
      const result = await this.store.addMany(unique);
      added = result.added;
      skipped += result.skipped;
    }
    this.changed();
    return { added, skipped };
  }

  /** Clears IndexedDB only; exported files on disk are untouched. */
  async clear(): Promise<void> {
    await this.store.clear();
    await this.store.setMeta(META_CLEARED_BY_USER, true);
    this.changed();
  }

  private changed(): void {
    for (const listener of this.changeListeners) listener();
  }
}

/** Removes duplicate ids within one batch (keeps the first). */
function dedupe(samples: GestureSample[]): GestureSample[] {
  const seen = new Set<string>();
  return samples.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

/** Asks the browser not to evict our IndexedDB data under storage pressure. */
async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return null;
  }
}
