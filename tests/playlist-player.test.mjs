import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffledPlaylistIndices } from '../.test-build/progress/audio/PlaylistMiniPlayer.js';

test('shuffled music order contains each track exactly once', () => {
  const indices = shuffledPlaylistIndices(6, () => 0.5);
  assert.equal(indices.length, 6);
  assert.deepEqual([...indices].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
});

test('shuffle handles a single track and an empty playlist', () => {
  assert.deepEqual(shuffledPlaylistIndices(1, () => 0.5), [0]);
  assert.deepEqual(shuffledPlaylistIndices(0, () => 0.5), []);
  assert.deepEqual(shuffledPlaylistIndices(-2, () => 0.5), []);
});
