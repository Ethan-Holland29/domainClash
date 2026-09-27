import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CombatManager } from '../.test-build/progress/combat/CombatManager.js';
import { LINE_MS, MOVE_LINE_MS, effectCue } from '../.test-build/progress/combat/BattlePlayback.js';
import { ABILITY_POPUP_MS, abilityPopupText, moveSummary, statusChips } from '../.test-build/progress/combat/CombatPanel.js';
import { CHARACTERS } from '../.test-build/progress/characters/Characters.js';
import { BASE, createBattle, resolveTurn } from '../shared/battle.mjs';

const character = (id) => CHARACTERS.find((c) => c.id === id);
function match(id = 'gojo', enemy = 'choso', random = () => 0.5) {
  const m = new CombatManager(character(id), random);
  const cues = [];
  m.onEffect = (cue) => cues.push(cue);
  m.reset(character(id), character(enemy));
  return { m, cues };
}
const finishTurn = (m) => { for (let i = 0; i < 40 && m.status === 'resolving'; i++) m.tick(MOVE_LINE_MS); };

test('solo battle is turn-based: nothing happens until the player picks, then the computer answers', () => {
  const { m } = match();
  assert.equal(m.attack('BASIC_PUNCH'), false, 'no moves before Start');
  m.start();
  assert.equal(m.status, 'choosing');
  m.tick(60000);
  assert.deepEqual([m.player.hp, m.opponent.hp], [BASE.hp, BASE.hp], 'no real-time attacks');
  assert.equal(m.attack('BASIC_PUNCH'), true);
  assert.equal(m.status, 'resolving');
  assert.equal(m.attack('BASIC_PUNCH'), false, 'one move per turn');
  finishTurn(m);
  assert.equal(m.status, 'choosing');
  assert.equal(m.state.turn, 2);
  assert.ok(m.log.some((t) => t === 'Satoru Gojo used Basic Punch!'));
  assert.ok(m.log.some((t) => t.startsWith('Choso used ')), m.log.join(' | '));
});

test('battle text plays one line at a time and health follows the text', () => {
  const { m, cues } = match('yuji', 'toji');
  m.start();
  m.attack('BASIC_PUNCH');
  const first = m.line.text;
  const firstDuration = m.line.event?.type === 'move' ? MOVE_LINE_MS : LINE_MS;
  assert.equal(m.playback.shownHp[0], BASE.hp);
  m.tick(firstDuration - 1);
  assert.equal(m.line.text, first, 'line stays up');
  m.tick(1);
  assert.notEqual(m.line.text, first);
  assert.equal(cues.length, 1, 'effect cue for the first move');
  finishTurn(m);
  assert.deepEqual(m.playback.shownHp, [m.player.hp, m.opponent.hp]);
  assert.equal(cues.length, 2);
  assert.ok(cues.every((c) => c.hit));
  assert.deepEqual(cues.map((c) => c.side).sort(), ['enemy', 'player']);
});

test('skip shows the whole turn at once', () => {
  const { m } = match();
  m.start();
  m.attack('REVERSAL_RED');
  m.skip();
  assert.equal(m.status, 'choosing');
  assert.deepEqual(m.playback.shownHp, [m.player.hp, m.opponent.hp]);
});

test('unavailable moves are refused with a reason and do not use the turn', () => {
  const { m } = match('gojo', 'sukuna');
  m.start();
  assert.equal(m.attack('GOJO_ULTIMATE'), false);
  assert.equal(m.line.text, 'Needs 100 meter');
  assert.equal(m.attack('CLEAVE'), false);
  assert.equal(m.status, 'choosing');
  assert.match(m.options().find((o) => o.id === 'HOLLOW_PURPLE').reason, /Unlock: Red 0\/2 · Blue 0\/2/);
});

test('status-forced turns resolve automatically instead of leaving solo combat stuck', () => {
  const { m } = match('gojo', 'choso');
  m.start();
  m.attack('BASIC_PUNCH');
  m.player.bloodBlindTurns = 1;
  finishTurn(m);
  assert.equal(m.status, 'choosing');
  assert.equal(m.state.turn, 3, 'normal turn and forced skip both advanced');
  assert.ok(m.log.some((text) => text.includes('spends the turn wiping blood')));

  const purple = match('gojo', 'sukuna').m;
  purple.start();
  purple.player.ce = 100; purple.player.redUses = 2; purple.player.blueUses = 2;
  assert.equal(purple.attack('HOLLOW_PURPLE'), true);
  finishTurn(purple);
  assert.equal(purple.status, 'choosing');
  assert.equal(purple.player.recovery, 0, 'all three recovery turns played through automatically');
  assert.equal(purple.state.turn, 5, 'Purple plus its three forced recovery turns advanced');
  assert.equal(purple.log.filter((text) => text.includes('skips a turn to recover')).length, 3);
});

test('camera ability banners show only the character and ability label', () => {
  assert.equal(ABILITY_POPUP_MS, 3200, 'ability callouts remain visible for just over three seconds');
  const gojo = createBattle('gojo', 'sukuna').sides[0];
  assert.equal(abilityPopupText({ type: 'passive', passive: 'Limitless' }, gojo), 'Satoru Gojo’s Limitless');
  assert.equal(abilityPopupText({ type: 'passive' }, createBattle('sukuna', 'gojo').sides[0]), null,
    'flavor-only passive log lines do not get duplicated into a popup');
  assert.equal(abilityPopupText({ type: 'black-flash' }, createBattle('yuji', 'gojo').sides[0]), 'Yuji Itadori’s Black Flash');
});

test('winning, losing and restarting', () => {
  const { m } = match('gojo', 'sukuna');
  m.start();
  m.state.sides[1].hp = 1;
  m.attack('BASIC_PUNCH');
  finishTurn(m);
  assert.equal(m.status, 'won');
  assert.equal(m.attack('BASIC_PUNCH'), false);
  m.reset();
  assert.equal(m.status, 'ready');
  assert.equal(m.opponent.hp, 175, 'Sukuna keeps his restored 175 HP starting value');
  const lost = match('gojo', 'sukuna', () => 0.6).m;
  lost.start();
  lost.state.sides[0].hp = 1;
  lost.attack('BASIC_PUNCH');
  finishTurn(lost);
  assert.equal(lost.status, 'lost');
});

test('effect cues: Guard plays the block effect, misses and blocks are marked, Mahoraga uses its own effect', () => {
  const guard = resolveTurn(createBattle('gojo', 'sukuna'), ['GUARD', 'CLEAVE'], () => 0.5);
  const moves = guard.events.filter((e) => e.type === 'move');
  const rest = (e) => guard.events.slice(guard.events.indexOf(e) + 1);
  assert.deepEqual(effectCue(guard.state, moves[0], rest(moves[0])), { character: 'gojo', action: 'BLOCK', side: 'player', hit: true, blackFlash: false, healing: false });
  assert.equal(effectCue(guard.state, moves[1], rest(moves[1])).hit, false);
  assert.equal(effectCue(guard.state, moves[1], rest(moves[1]), 1).side, 'player', 'online seat 1 sees its own move as the player');
  const swallow = resolveTurn(createBattle('geto', 'gojo'), ['CURSE_SWALLOW', 'BASIC_PUNCH'], () => 0.5);
  const swallowMove = swallow.events.find((event) => event.type === 'move' && event.move === 'CURSE_SWALLOW');
  assert.equal(effectCue(swallow.state, swallowMove, swallow.events.slice(swallow.events.indexOf(swallowMove) + 1)).healing, true, 'healing moves request the green cross particles');
  const state = createBattle('megumi', 'toji');
  state.sides[0].hp = 49;
  const summon = resolveTurn(state, ['MAHORAGA', 'BASIC_PUNCH'], () => 0.4);
  const move = summon.events.find((event) => event.type === 'move');
  const cue = effectCue(summon.state, move, summon.events.slice(summon.events.indexOf(move) + 1));
  assert.equal(cue.character, 'megumi');
  assert.equal(cue.action, 'MAHORAGA');
});

test('panel helpers describe moves and statuses', () => {
  const f = createBattle('choso', 'gojo').sides[0];
  assert.equal(moveSummary(f, 'PIERCING_BLOOD'), '20 damage · +15 vs Megumi after a recent summon · +20 meter');
  assert.equal(moveSummary(f, 'BASIC_PUNCH'), '10 damage · +5 meter · 10% miss');
  assert.equal(moveSummary(createBattle('toji', 'gojo').sides[0], 'CURSED_TOOLS'), '30, 35, or 40 damage · 2-turn cooldown · 33% chance to give the opponent +10 damage next turn');
  assert.equal(moveSummary(createBattle('toji', 'gojo').sides[0], 'BASIC_PUNCH'), '15 damage · +10 meter · 10% miss');
  assert.equal(moveSummary(createBattle('sukuna', 'gojo').sides[0], 'BASIC_PUNCH'), '5 damage · +5 meter · 10% miss');
  assert.match(moveSummary(createBattle('yuji', 'gojo').sides[0], 'BASIC_PUNCH'), /33% Black Flash/);
  const state = createBattle('sukuna', 'gojo');
  state.sides[1].stages.spd = -1; state.sides[1].bleed = 2; state.sides[1].stunned = true;
  state.domain = { owner: 0, move: 'SUKUNA_ULTIMATE', turns: 2 };
  assert.deepEqual(statusChips(state, 1), ['Spd -1', 'Stunned', 'Bleeding 2']);
  assert.deepEqual(statusChips(state, 0), ['Malevolent Shrine · 2 turns']);
  assert.ok(LINE_MS < MOVE_LINE_MS);
});
