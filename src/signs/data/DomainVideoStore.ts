/**
 * Persists user-uploaded Domain Expansion videos in IndexedDB, one per
 * domain (keyed by the domain gesture id, e.g. "malevolent-shrine"). Videos
 * stay in this browser profile on this machine; nothing is uploaded anywhere.
 *
 * Uses its own database so large video blobs never touch the gesture dataset.
 */
const DB_NAME = 'domainclash-media';
const DB_VERSION = 1;
const VIDEOS = 'domainVideos';

export interface DomainVideoInfo {
  domainId: string;
  fileName: string;
  size: number;
  type: string;
  addedAt: number;
}

interface StoredVideo extends DomainVideoInfo {
  blob: Blob;
}

export class DomainVideoStore {
  private readonly db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  static async open(): Promise<DomainVideoStore> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available in this browser.');
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(VIDEOS)) {
        request.result.createObjectStore(VIDEOS, { keyPath: 'domainId' });
      }
    };
    return new DomainVideoStore(await result(request));
  }

  /** Saves (or replaces) the video for a domain. */
  async save(domainId: string, file: File): Promise<DomainVideoInfo> {
    const record: StoredVideo = {
      domainId,
      fileName: file.name,
      size: file.size,
      type: file.type || 'video/mp4',
      addedAt: Date.now(),
      blob: file,
    };
    const tx = this.db.transaction(VIDEOS, 'readwrite');
    tx.objectStore(VIDEOS).put(record);
    await done(tx);
    return info(record);
  }

  async remove(domainId: string): Promise<void> {
    const tx = this.db.transaction(VIDEOS, 'readwrite');
    tx.objectStore(VIDEOS).delete(domainId);
    await done(tx);
  }

  /** Info about every stored video, without loading the blobs' contents. */
  async list(): Promise<DomainVideoInfo[]> {
    const tx = this.db.transaction(VIDEOS, 'readonly');
    const all = await result(tx.objectStore(VIDEOS).getAll() as IDBRequest<StoredVideo[]>);
    return all.map(info);
  }

  /** The stored video for a domain, or null. */
  async get(domainId: string): Promise<Blob | null> {
    const tx = this.db.transaction(VIDEOS, 'readonly');
    const record = await result(tx.objectStore(VIDEOS).get(domainId) as IDBRequest<StoredVideo | undefined>);
    return record?.blob ?? null;
  }
}

function info({ domainId, fileName, size, type, addedAt }: StoredVideo): DomainVideoInfo {
  return { domainId, fileName, size, type, addedAt };
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}
