import { DATASET_FILENAME, DATASET_FORMAT, type GestureSample } from './GestureDatasetTypes';
import { DatasetValidationError, toDatasetFile, validateDataset } from './GestureDatasetImportExport';

/**
 * Merge-only import/export on top of the original dataset format.
 *
 * The original validator (GestureDatasetImportExport, unchanged) rejects a
 * whole file on the first bad sample. Here each sample is validated with that
 * same validator on its own, so compatible samples are merged and incompatible
 * ones are reported instead of discarding the file. Nothing here deletes or
 * replaces existing recordings.
 *
 * Export writes the original format. Recordings made with the combined
 * build's pose library are embedded under `legacyPoseLibrary`, an extra field
 * the original project's importer ignores, so a file exported here re-imports
 * everything - here and in the original project.
 */

/** Extra top-level field carrying combined-build pose-library recordings. */
export const LEGACY_POSES_FIELD = 'legacyPoseLibrary';

export interface RejectedSample {
  /** 1-based position in the file. */
  index: number;
  reason: string;
}

export interface MergePlan {
  /** Original-format samples that passed validation. */
  samples: GestureSample[];
  /** Samples that failed validation (not imported). */
  rejected: RejectedSample[];
  /**
   * Combined-build pose library to merge (from a legacy backup file, or
   * embedded in a dataset export), not yet validated - the app validates it.
   */
  legacyPoses: unknown | null;
}

/** Parses an import file without throwing on individual bad samples. */
export function planMerge(text: string): MergePlan {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new DatasetValidationError(`Not valid JSON: ${(err as Error).message}`);
  }
  if (!isObject(data)) throw new DatasetValidationError('Top level must be a JSON object.');

  // A combined-build pose-library backup: { GESTURE_ID: [pose, ...], ... } with no dataset format.
  if (data.format === undefined && !('samples' in data)) {
    return { samples: [], rejected: [], legacyPoses: data };
  }
  if (!Array.isArray(data.samples)) {
    // Let the original validator produce the precise message (format / schema / samples).
    validateDataset(data);
    throw new DatasetValidationError('"samples" must be an array.');
  }

  const envelope = { ...data, samples: [] as unknown[] };
  validateDataset(envelope); // format + schema version, with the original messages

  const samples: GestureSample[] = [];
  const rejected: RejectedSample[] = [];
  data.samples.forEach((raw, i) => {
    try {
      samples.push(...validateDataset({ ...envelope, samples: [raw] }));
    } catch (err) {
      const why = err instanceof Error ? err.message.replace(/^Sample #1: /, '') : String(err);
      rejected.push({ index: i + 1, reason: why });
    }
  });
  return { samples, rejected, legacyPoses: data[LEGACY_POSES_FIELD] ?? null };
}

/** The export file: the original dataset format, plus the pose library when there is one. */
export function exportText(samples: GestureSample[], legacyPoses: unknown | null): string {
  const file: Record<string, unknown> = { ...toDatasetFile(samples) };
  if (legacyPoses && isObject(legacyPoses) && Object.keys(legacyPoses).length) file[LEGACY_POSES_FIELD] = legacyPoses;
  return JSON.stringify(file, null, 2);
}

export function downloadText(text: string, filename = DATASET_FILENAME): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { DATASET_FORMAT };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
