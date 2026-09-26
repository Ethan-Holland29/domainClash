import {
  DATASET_FILENAME,
  DATASET_FORMAT,
  DATASET_SCHEMA_VERSION,
  type GestureDatasetFile,
  type GestureSample,
} from './GestureDatasetTypes';

const LANDMARKS_PER_HAND = 21;

export class DatasetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetValidationError';
  }
}

// ---------- export ----------

export function countByLabel(samples: GestureSample[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of samples) counts[s.label] = (counts[s.label] ?? 0) + 1;
  return counts;
}

export function toDatasetFile(samples: GestureSample[]): GestureDatasetFile {
  const counts = countByLabel(samples);
  return {
    format: DATASET_FORMAT,
    schemaVersion: DATASET_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    labels: Object.keys(counts).sort(),
    counts,
    samples: [...samples].sort((a, b) => a.timestamp - b.timestamp),
  };
}

/** Indented, human-readable JSON. */
export function serializeDataset(samples: GestureSample[]): string {
  return JSON.stringify(toDatasetFile(samples), null, 2);
}

/** Saves the dataset as a JSON file through the browser's normal download flow. */
export function downloadDataset(samples: GestureSample[], filename = DATASET_FILENAME): void {
  const blob = new Blob([serializeDataset(samples)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- import ----------

/** Parses and validates dataset JSON text. Throws DatasetValidationError with a readable reason. */
export function parseDataset(text: string): GestureSample[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new DatasetValidationError(`Not valid JSON: ${(err as Error).message}`);
  }
  return validateDataset(data);
}

export function validateDataset(data: unknown): GestureSample[] {
  if (!isObject(data)) throw new DatasetValidationError('Top level must be a JSON object.');
  if (data.format !== DATASET_FORMAT) {
    throw new DatasetValidationError(`Missing or wrong "format" (expected "${DATASET_FORMAT}").`);
  }
  const version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new DatasetValidationError('Missing or invalid "schemaVersion".');
  }
  if (version > DATASET_SCHEMA_VERSION) {
    throw new DatasetValidationError(
      `File uses schema v${version}, but this app only understands up to v${DATASET_SCHEMA_VERSION}. Update the app first.`,
    );
  }
  if (!Array.isArray(data.samples)) throw new DatasetValidationError('"samples" must be an array.');
  return data.samples.map((raw, i) => validateSample(migrateSample(raw, version), i));
}

/** Upgrades a sample from an older schema version. Only v1 exists so far. */
function migrateSample(raw: unknown, _fromVersion: number): unknown {
  return raw;
}

function validateSample(raw: unknown, index: number): GestureSample {
  const fail = (why: string): never => {
    throw new DatasetValidationError(`Sample #${index + 1}: ${why}`);
  };
  if (!isObject(raw)) return fail('must be an object.');
  if (typeof raw.label !== 'string' || raw.label.trim() === '') fail('"label" must be a non-empty string.');
  if (!isFiniteNumber(raw.timestamp)) fail('"timestamp" must be a number (epoch ms).');
  if (!isFiniteNumber(raw.aspectRatio) || (raw.aspectRatio as number) <= 0) fail('"aspectRatio" must be a positive number.');
  if (!Array.isArray(raw.hands)) fail('"hands" must be an array.');
  (raw.hands as unknown[]).forEach((hand, h) => {
    if (!isObject(hand)) fail(`hand ${h + 1} must be an object.`);
    const hd = hand as Record<string, unknown>;
    if (!['Left', 'Right', 'Unknown'].includes(hd.handedness as string)) fail(`hand ${h + 1} has invalid "handedness".`);
    if (!isFiniteNumber(hd.handednessScore)) fail(`hand ${h + 1} "handednessScore" must be a number.`);
    if (!isLandmarkList(hd.landmarks)) fail(`hand ${h + 1} "landmarks" must be ${LANDMARKS_PER_HAND} {x,y,z} points.`);
    if (!isLandmarkList(hd.worldLandmarks) && !(Array.isArray(hd.worldLandmarks) && hd.worldLandmarks.length === 0)) {
      fail(`hand ${h + 1} "worldLandmarks" must be ${LANDMARKS_PER_HAND} {x,y,z} points or empty.`);
    }
  });
  if (!isObject(raw.features)) fail('"features" must be an object.');

  const sample = raw as unknown as GestureSample;
  return {
    ...sample,
    schemaVersion: DATASET_SCHEMA_VERSION,
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : contentId(sample),
  };
}

/** Deterministic id from content, for samples that arrive without one (e.g. hand-made files). */
function contentId(sample: GestureSample): string {
  const text = JSON.stringify([sample.label, sample.timestamp, sample.hands.map((h) => h.landmarks)]);
  let hash = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `content-${(hash >>> 0).toString(16)}-${sample.timestamp}`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

function isLandmarkList(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length === LANDMARKS_PER_HAND &&
    v.every((p) => isObject(p) && isFiniteNumber(p.x) && isFiniteNumber(p.y) && isFiniteNumber(p.z))
  );
}

// ---------- bundled default dataset ----------

/**
 * Optional default dataset at <project>/data/gesture-dataset.json. Vite
 * bundles it when present; when absent the glob is simply empty, so no file
 * is required and nothing is fetched from a server.
 */
const bundled = import.meta.glob<string>('/data/gesture-dataset.json', { query: '?raw', import: 'default' });

export async function loadBundledDataset(): Promise<GestureSample[] | null> {
  const load = Object.values(bundled)[0];
  if (!load) return null;
  return parseDataset(await load());
}
