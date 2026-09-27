import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { voiceForBattleEvent, voiceForSelection } from '../src/progress/audio/VoiceRouter.mjs';
import { sfxForBattleEvent } from '../src/progress/audio/BattleSfxRouter.mjs';

const event = (type, extra = {}) => ({ type, text: '', hp: [200, 200], maxHp: [200, 200], ce: [0, 0], ...extra });

test('selection voice clips are assigned to characters with provided selection quotes', () => {
  assert.equal(voiceForSelection('gojo'), 'gojo-selected');
  assert.equal(voiceForSelection('toji'), 'toji-selected');
  assert.equal(voiceForSelection('geto'), 'geto-selected');
  assert.equal(voiceForSelection('ryu'), 'ryu-selected');
  assert.equal(voiceForSelection('sukuna'), 'sukuna-selected');
  assert.equal(voiceForSelection('choso'), 'choso-selected');
  assert.equal(voiceForSelection('megumi'), 'megumi-selected');
  assert.equal(voiceForSelection('yuji'), 'yuji-selected');
  assert.equal(voiceForSelection('yuta'), 'yuta-selected');
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
  assert.equal(voiceForBattleEvent(event('move', { move: 'MAHORAGA' })), null, 'the three-line summon sequence plays together when Mahoraga arrives');
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

test('Sukuna and Choso voice clips follow selection and their corresponding moves', () => {
  assert.equal(voiceForSelection('sukuna'), 'sukuna-selected');
  assert.equal(voiceForSelection('choso'), 'choso-selected');
  assert.equal(voiceForBattleEvent(event('move', { move: 'SUKUNA_ULTIMATE' })), 'sukuna-domain');
  assert.equal(voiceForBattleEvent(event('move', { move: 'PIERCING_BLOOD' })), 'choso-piercing-blood');
  assert.equal(voiceForBattleEvent(event('move', { move: 'CHOSO_ULTIMATE' })), 'choso-supernova');
  assert.equal(voiceForBattleEvent(event('black-flash', { text: 'Black Flash!' })), 'yuji-black-flash');
});

test('Yuji voice lines route to selection and Straight Hands', () => {
  assert.equal(voiceForBattleEvent(event('move', { move: 'YUJI_ULTIMATE' })), 'yuji-straight-hands');
  assert.equal(voiceForBattleEvent(event('black-flash', { text: 'Straight Hands: four punches, 3 Black Flash hit(s).' })), 'yuji-black-flash', 'Straight Hands emits one aggregate Black Flash event even if several hits flash');
});

test('Yuta quotes route to selection and Rika, with the local voice clips present', () => {
  assert.equal(voiceForBattleEvent(event('move', { move: 'RIKA' })), 'yuta-rika');
  for (const file of ['yuta-come-to-me-rika.mp3','yuta-lend-me-your-strength.mp3','yuji-black-flash.mp3']) assert.ok(fs.existsSync(`public/audio/voices/${file}`), file);
});

test('combat sound effects route to the requested actions', () => {
  assert.deepEqual(sfxForBattleEvent(event('move', { move: 'GUARD' })), ['shield-block']);
  assert.deepEqual(sfxForBattleEvent(event('move', { move: 'BASIC_PUNCH' }), () => 0), ['punch-1']);
  assert.deepEqual(sfxForBattleEvent(event('move', { move: 'BASIC_PUNCH' }), () => 0.999), ['punch-4']);
  assert.deepEqual(sfxForBattleEvent(event('move', { move: 'YUJI_ULTIMATE' })), ['punch-3', 'punch-3', 'punch-3', 'punch-4']);
  assert.deepEqual(sfxForBattleEvent(event('move', { move: 'CURSED_FISTS' })), ['cursed-fists-fire']);
  assert.deepEqual(sfxForBattleEvent(event('move', { move: 'CLEAVE' })), ['sword-slashes']);
  assert.deepEqual(sfxForBattleEvent(event('move', { move: 'CURSED_TOOLS' })), ['sword-slashes']);
  assert.deepEqual(sfxForBattleEvent(event('passive', { passive: 'Shadow Dweller' })), ['sword-slashes']);
  assert.deepEqual(sfxForBattleEvent(event('passive', { passive: 'Limitless' })), []);
});
