import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = (() => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; })();
const { planMerge, exportText, LEGACY_POSES_FIELD } = await import('../.test-build/signs/data/DatasetMerge.js');
const { toDatasetFile } = await import('../.test-build/signs/data/GestureDatasetImportExport.js');
const { PoseLibrary, MAX_POSES_PER_SIGN } = await import('../.test-build/progress/calibration/PoseLibrary.js');
const { SIGN_TUNING } = await import('../.test-build/signs/handTracking/GestureDefinitions.js');

const lm = (dx = 0) => Array.from({ length: 21 }, (_, i) => ({ x: 0.4 + (i % 4) * 0.02 + dx, y: 0.7 - Math.floor(i / 4) * 0.03, z: 0 }));
const sample = (id, label = 'CLEAVE', dx = 0) => ({
  id, schemaVersion: 1, label, timestamp: 1_700_000_000_000 + id.length, aspectRatio: 4 / 3,
  hands: [{ handedness: 'Right', handednessScore: 0.98, landmarks: lm(dx), worldLandmarks: lm(dx) }],
  features: { hands: [], pair: null, signScores: {} },
});
const pose = v => [Array.from({ length: 65 }, (_, i) => (i % 7) * 0.1 + v)];

test('Trusted threshold is 300 saved instances', () => {
  assert.equal(SIGN_TUNING.learned.trustedSamples, 300);
});

test('original-format file: every compatible sample is merged, invalid ones reported not fatal', () => {
  const file = toDatasetFile([sample('a'), sample('b', 'NUE')]);
  file.samples.splice(1, 0, { ...sample('bad'), hands: [{ handedness: 'Right', handednessScore: 1, landmarks: [], worldLandmarks: [] }] });
  const plan = planMerge(JSON.stringify(file));
  assert.deepEqual(plan.samples.map(s => s.id), ['a', 'b']);
  assert.equal(plan.rejected.length, 1);
  assert.equal(plan.rejected[0].index, 2);
  assert.match(plan.rejected[0].reason, /landmarks/);
  assert.equal(plan.legacyPoses, null);
});

test('non-dataset files are rejected with the original validator messages', () => {
  assert.throws(() => planMerge('not json'), /Not valid JSON/);
  assert.throws(() => planMerge(JSON.stringify({ format: 'other', schemaVersion: 1, samples: [] })), /format/);
  assert.throws(() => planMerge(JSON.stringify({ format: 'domainclash-gesture-dataset', schemaVersion: 99, samples: [] })), /schema v99/);
  assert.throws(() => planMerge('[1,2]'), /JSON object/);
});

test('export -> import round trip keeps every sample identical, plus pose-library recordings', () => {
  const samples = [sample('x1'), sample('x2', 'NUE', 0.01), sample('x3', 'NONE', 0.02)];
  const legacy = { CLEAVE: [pose(0.1)], NUE: [pose(0.2), pose(0.3)] };
  const text = exportText(samples, legacy);
  const parsed = JSON.parse(text);
  assert.equal(parsed.format, 'domainclash-gesture-dataset');
  assert.equal(parsed.schemaVersion, 1);
  assert.deepEqual(parsed[LEGACY_POSES_FIELD], legacy);
  const plan = planMerge(text);
  assert.deepEqual(plan.samples, samples.slice().sort((a, b) => a.timestamp - b.timestamp));
  assert.equal(plan.rejected.length, 0);
  assert.deepEqual(plan.legacyPoses, legacy);
  // Without pose-library data the file is exactly the original export format.
  assert.equal(JSON.parse(exportText(samples, null))[LEGACY_POSES_FIELD], undefined);
});

test('a combined-build pose-library backup is recognised as such', () => {
  const plan = planMerge(JSON.stringify({ CLEAVE: [pose(0.1)] }));
  assert.equal(plan.samples.length, 0);
  assert.deepEqual(plan.legacyPoses, { CLEAVE: [pose(0.1)] });
});

test('pose-library merge never replaces or deletes, skips duplicates, respects the per-sign limit', () => {
  const lib = new PoseLibrary();
  lib.replace({ CLEAVE: [pose(0.1), pose(0.2)] });
  const r = lib.merge({ CLEAVE: [pose(0.2), pose(0.4)], NUE: [pose(0.5)] });
  assert.deepEqual(r, { added: 2, duplicates: 1, overLimit: 0 });
  assert.deepEqual(lib.data.CLEAVE, [pose(0.1), pose(0.2), pose(0.4)]);
  assert.deepEqual(lib.data.NUE, [pose(0.5)]);
  assert.throws(() => lib.merge({ CLEAVE: 'nope' }), /Invalid/);
  assert.deepEqual(lib.data.CLEAVE, [pose(0.1), pose(0.2), pose(0.4)], 'failed merge changes nothing');
  const full = Array.from({ length: MAX_POSES_PER_SIGN }, (_, i) => pose(1 + i * 0.001));
  lib.replace({ CLEAVE: full });
  const over = lib.merge({ CLEAVE: [pose(9)] });
  assert.deepEqual(over, { added: 0, duplicates: 0, overLimit: 1 });
  assert.equal(lib.data.CLEAVE.length, MAX_POSES_PER_SIGN);
});

test('deleting one pose-library attack keeps other attacks and persists the remaining set', () => {
  const lib = new PoseLibrary();
  lib.replace({ CLEAVE: [pose(0.1), pose(0.2)], NUE: [pose(0.3)] });
  assert.equal(lib.deleteGesture('CLEAVE'), 2);
  assert.deepEqual(lib.data, { NUE: [pose(0.3)] });
  assert.equal(lib.deleteGesture('CLEAVE'), 0);
  assert.deepEqual(JSON.parse(localStorage.getItem('domainclash.poses.v1')), { NUE: [pose(0.3)] });
});

test('batched saving writes every recorded frame once, in order, in few storage calls', async () => {
  const { BatchedSaver } = await import('../.test-build/signs/data/BatchedSaver.js');
  const writes = [];
  const saver = new BatchedSaver(async (batch) => { writes.push(batch.map((s) => s.id)); }, 20, 50);
  const done = Array.from({ length: 120 }, (_, i) => saver.save(sample(`f${i}`)));
  await Promise.all(done);
  assert.deepEqual(writes.flat(), Array.from({ length: 120 }, (_, i) => `f${i}`));
  assert.ok(writes.length <= 4, `${writes.length} writes for 120 frames`);
  const failing = new BatchedSaver(async () => { throw new Error('disk full'); }, 5);
  await assert.rejects(failing.save(sample('x')), /disk full/);
});
