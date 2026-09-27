import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceForBattleEvent, voiceForSelection } from '../src/progress/audio/VoiceRouter.mjs';

const event = (type, extra = {}) => ({ type, text: '', hp: [200, 200], maxHp: [200, 200], ce: [0, 0], ...extra });

test('selection voice clips are assigned to characters with provided selection quotes', () => {
  assert.equal(voiceForSelection('gojo'), 'gojo-selected');
  assert.equal(voiceForSelection('toji'), 'toji-selected');
  assert.equal(voiceForSelection('geto'), 'geto-selected');
  assert.equal(voiceForSelection('ryu'), 'ryu-selected');
  assert.equal(voiceForSelection('megumi'), null);
});

test('Gojo voice clips follow their corresponding moves and Limitless passive', () => {
  assert.equal(voiceForBattleEvent(event('move', { move: 'REVERSAL_RED' })), 'gojo-red');
  assert.equal(voiceForBattleEvent(event('move', { move: 'AMPLIFICATION_BLUE' })), 'gojo-blue');
  assert.equal(voiceForBattleEvent(event('move', { move: 'HOLLOW_PURPLE' })), 'gojo-hollow-purple');
  assert.equal(voiceForBattleEvent(event('passive', { passive: 'Limitless' })), 'gojo-limitless');
});

test('Megumi, Mahoraga, and Toji clips route only from their intended battle events', () => {
  assert.equal(voiceForBattleEvent(event('move', { move: 'NUE' })), 'megumi-nue');
  assert.equal(voiceForBattleEvent(event('move', { move: 'DIVINE_DOGS' })), 'megumi-dogs');
  assert.equal(voiceForBattleEvent(event('move', { move: 'MAHORAGA' })), 'megumi-treasure');
  assert.equal(voiceForBattleEvent(event('move', { move: 'MEGUMI_ULTIMATE' })), 'megumi-domain');
  assert.equal(voiceForBattleEvent(event('mahoraga', { text: 'Mahoraga takes over.' })), 'megumi-mahoraga');
  assert.equal(voiceForBattleEvent(event('move', { move: 'CURSED_TOOLS' })), 'toji-tools');
  assert.equal(voiceForBattleEvent(event('damage', { move: 'NUE' })), null);
});

test('Geto and Ryu voice clips follow selection and their corresponding moves', () => {
  assert.equal(voiceForBattleEvent(event('move', { move: 'CURSE_SWALLOW' })), 'geto-swallow');
  assert.equal(voiceForBattleEvent(event('move', { move: 'GETO_ULTIMATE' })), 'geto-uzumaki');
  assert.equal(voiceForBattleEvent(event('move', { move: 'GRANITE_BLAST' })), 'ryu-granite-blast');
  assert.equal(voiceForBattleEvent(event('move', { move: 'RYU_ULTIMATE' })), 'ryu-sweet');
});
