import type { GestureSample } from './GestureDatasetTypes';

const DB_NAME = 'domainclash';
/** IndexedDB structure version (object stores / indexes), separate from the sample schema version. */
const DB_VERSION = 1;
const SAMPLES = 'gestureSamples';
const META = 'meta';

/**
 * IndexedDB persistence for gesture samples. The only module that touches
 * IndexedDB. Data lives in this browser profile on this machine; nothing is
 * sent anywhere.
 */
export class GestureDatasetStore {
  private readonly db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  static async open(): Promise<GestureDatasetStore> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in this browser (private mode?).');
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        const samples = db.createObjectStore(SAMPLES, { keyPath: 'id' });
        samples.createIndex('label', 'label');
        db.createObjectStore(META);
      }
    };
    return new GestureDatasetStore(await requestResult(request));
  }

  async add(sample: GestureSample): Promise<void> {
    const tx = this.db.transaction(SAMPLES, 'readwrite');
    tx.objectStore(SAMPLES).put(sample);
    await transactionDone(tx);
  }

  /** Adds samples, skipping any whose id is already stored. */
  async addMany(samples: GestureSample[]): Promise<{ added: number; skipped: number }> {
    const existing = new Set(await this.allIds());
    const fresh = samples.filter((s) => !existing.has(s.id));
    const tx = this.db.transaction(SAMPLES, 'readwrite');
    const store = tx.objectStore(SAMPLES);
    for (const s of fresh) store.put(s);
    await transactionDone(tx);
    return { added: fresh.length, skipped: samples.length - fresh.length };
  }

  /** Atomically replaces the whole dataset. */
  async replaceAll(samples: GestureSample[]): Promise<void> {
    const tx = this.db.transaction(SAMPLES, 'readwrite');
    const store = tx.objectStore(SAMPLES);
    store.clear();
    for (const s of samples) store.put(s);
    await transactionDone(tx);
  }

  async getAll(): Promise<GestureSample[]> {
    const tx = this.db.transaction(SAMPLES, 'readonly');
    return requestResult(tx.objectStore(SAMPLES).getAll() as IDBRequest<GestureSample[]>);
  }

  async count(): Promise<number> {
    const tx = this.db.transaction(SAMPLES, 'readonly');
    return requestResult(tx.objectStore(SAMPLES).count());
  }

  async clear(): Promise<void> {
    const tx = this.db.transaction(SAMPLES, 'readwrite');
    tx.objectStore(SAMPLES).clear();
    await transactionDone(tx);
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const tx = this.db.transaction(META, 'readonly');
    return requestResult(tx.objectStore(META).get(key) as IDBRequest<T | undefined>);
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    const tx = this.db.transaction(META, 'readwrite');
    tx.objectStore(META).put(value, key);
    await transactionDone(tx);
  }

  private async allIds(): Promise<string[]> {
    const tx = this.db.transaction(SAMPLES, 'readonly');
    return requestResult(tx.objectStore(SAMPLES).getAllKeys() as IDBRequest<string[]>);
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}
