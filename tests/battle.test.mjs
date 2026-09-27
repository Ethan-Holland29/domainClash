import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE, MOVES, CHARACTERS, CHARACTER_IDS, createBattle, resolveTurn,
  unavailableReason, moveOptions, maxMeter,
} from '../shared/battle.mjs';

const middle = () => 0.5;
const high = () => 0.9;
const round = (state, p1, p2, random = middle) => resolveTurn(state, [p1, p2], random);
const eventTexts = (events) => events.map((e) => e.text);

test('the restored roster uses the original move names, starting resources and kits', () => {
  assert.deepEqual(CHARACTER_IDS, ['gojo', 'megumi', 'sukuna', 'choso', 'ryu', 'yuji', 'toji', 'geto', 'yuta']);
  assert.equal(BASE.ceStart, 0);
  assert.equal(createBattle('sukuna', 'gojo').sides[0].hp, 175);
  assert.equal(maxMeter(createBattle('sukuna', 'gojo').sides[0]), 150);
  assert.equal(MOVES.BASIC_PUNCH.name, 'Basic Punch');
  assert.equal(MOVES.DIVINE_DOGS.name, 'Demon Dogs');
  assert.equal(MOVES.RYU_ULTIMATE.name, 'Way Too Sweet!');
  assert.equal(MOVES.YUJI_ULTIMATE.name, 'Straight Hands');
  assert.equal(MOVES.YUTA_ULTIMATE.name, 'Copy');
  assert.equal(CHARACTERS.yuta.moves.at(-1), 'YUTA_ULTIMATE');
  const labels = {
    BASIC_PUNCH: 'Basic Punch', GUARD: 'Guard', AMPLIFICATION_BLUE: 'Amplification: Blue',
    REVERSAL_RED: 'Reversal: Red', HOLLOW_PURPLE: 'Hollow Purple',
    GOJO_ULTIMATE: 'Domain Expansion: Unlimited Void', NUE: 'Nue', DIVINE_DOGS: 'Demon Dogs',
    MAHORAGA: 'Mahoraga', MEGUMI_ULTIMATE: 'Domain Expansion: Chimera Shadow Garden',
    CLEAVE: 'Cleave', SUKUNA_ULTIMATE: 'Domain Expansion: Malevolent Shrine',
    PIERCING_BLOOD: 'Piercing Blood', CHOSO_ULTIMATE: 'Supernova', GRANITE_BLAST: 'Granite Blast',
    RYU_ULTIMATE: 'Way Too Sweet!', YUJI_ULTIMATE: 'Straight Hands', CURSED_FISTS: 'Cursed Fists', CURSED_TOOLS: 'Cursed Tools',
    CURSE_SWALLOW: 'Curse Swallow', GETO_ULTIMATE: 'Maximum: Uzumaki', RIKA: 'Rika',
    YUTA_ULTIMATE: 'Copy', MAHORAGA_STRIKE: 'Mahoraga Strike',
  };
  for (const [id, name] of Object.entries(labels)) assert.equal(MOVES[id].name, name, `${id} label on the selection and combat screens`);
  assert.equal(JSON.parse(JSON.stringify(createBattle('gojo', 'yuta'))).turn, 1, 'battle state remains safe for online sync');
});

test('Gojo Red and Blue have separate three-turn cooldowns; Blue drains meter and cannot be spammed', () => {
  let state = createBattle('gojo', 'toji');
  state.sides[0].ce = 30;
  state.sides[1].ce = 25;
  let result = round(state, 'AMPLIFICATION_BLUE', 'BASIC_PUNCH', high);
  state = result.state;
  assert.equal(state.sides[0].hp, 185, 'Toji punch is 15');
  assert.equal(state.sides[0].ce, 50, 'Blue attempt gains 20 meter');
  assert.equal(state.sides[1].ce, 15, 'Blue drains 20 after Toji gains 10');
  assert.equal(unavailableReason(state, 0, 'AMPLIFICATION_BLUE'), 'Cooldown: 3 turn(s) remaining');
  assert.equal(unavailableReason(state, 0, 'REVERSAL_RED'), null, 'Red has an independent cooldown');
  assert.ok(eventTexts(result.events).includes('Toji Fushiguro took 10 damage.'));
  assert.equal(result.events.find((e) => e.type === 'move' && e.side === 0)?.text, 'Satoru Gojo used Amplification: Blue!');
  for (let i = 0; i < 3; i++) state = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', high).state;
  assert.equal(unavailableReason(state, 0, 'AMPLIFICATION_BLUE'), null, 'available again after three full turns');
  state.sides[0].ce = 30;
  const tojiBeforeRed = state.sides[1].hp;
  state = round(state, 'REVERSAL_RED', 'BASIC_PUNCH', high).state;
  assert.equal(state.sides[1].hp, tojiBeforeRed - 20, 'Red deals 20 damage');
  assert.equal(state.sides[0].ce, 50, 'Red grants 20 meter');
  assert.equal(unavailableReason(state, 0, 'REVERSAL_RED'), 'Cooldown: 3 turn(s) remaining');
});

test('Hollow Purple unlocks after two attempts each, spends all meter, and skips three later turns', () => {
  let state = createBattle('gojo', 'toji');
  state.sides[0].ce = 100;
  assert.match(unavailableReason(state, 0, 'HOLLOW_PURPLE'), /Unlock: Red 0\/2 · Blue 0\/2/);
  state.sides[0].redUses = 2;
  state.sides[0].blueUses = 2;
  const result = round(state, 'HOLLOW_PURPLE', 'BASIC_PUNCH', high);
  state = result.state;
  assert.equal(state.sides[0].ce, 0);
  assert.equal(state.sides[0].recovery, 3);
  assert.equal(state.sides[1].hp, 100);
  assert.ok(eventTexts(result.events).some((t) => t.includes('Hollow Purple dealt 100 damage.')));
  for (let i = 0; i < 3; i++) state = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', high).state;
  assert.equal(state.sides[0].recovery, 0);
  assert.equal(unavailableReason(state, 0, 'HOLLOW_PURPLE'), 'Needs 100 meter');
});

test('Unlimited Void hits for 40 and leaves two enemy attack attempts vulnerable to self-hit', () => {
  const state = createBattle('gojo', 'toji');
  state.sides[0].ce = 100;
  const result = round(state, 'GOJO_ULTIMATE', 'BASIC_PUNCH', high);
  assert.equal(result.state.sides[1].hp, 160);
  assert.equal(result.state.sides[1].voidAttacks, 2);
  assert.ok(eventTexts(result.events).includes('Domain Expansion: Unlimited Void dealt 40 damage.'));
  assert.equal(result.state.sides[0].ce, 0);
});

test('Megumi summons have their restored effects and one-use rules', () => {
  let state = createBattle('megumi', 'yuta');
  state.sides[0].hp = 150;
  let result = round(state, 'DIVINE_DOGS', 'BASIC_PUNCH', high);
  state = result.state;
  assert.equal(state.sides[0].hp, 160, 'heal 20 after taking Yuta’s 10 damage');
  assert.equal(state.sides[0].dogsTurns, 2, 'the first 5-damage bite happens on the summon turn');
  assert.equal(state.sides[1].hp, 195, 'Demon Dogs bite for 5 on the summon turn');
  assert.equal(unavailableReason(state, 0, 'DIVINE_DOGS'), 'Already summoned this match');

  state = createBattle('megumi', 'toji');
  result = round(state, 'NUE', 'BASIC_PUNCH', high);
  assert.equal(result.state.sides[1].hp, 195, 'Nue rolls one of 5/15/20/30 damage');
  assert.equal(result.state.sides[0].ce, 30, 'Nue grants 30 meter when used');
  assert.equal(unavailableReason(result.state, 0, 'NUE'), 'Already summoned this match');

  state = createBattle('megumi', 'toji');
  state.sides[0].ce = 100;
  state.sides[0].usedSummons = ['NUE', 'DIVINE_DOGS'];
  result = round(state, 'MEGUMI_ULTIMATE', 'BASIC_PUNCH', () => 0.1);
  assert.equal(result.state.sides[1].hp, 180, 'Chimera Shadow Garden deals 20');
  assert.deepEqual(result.state.sides[0].usedSummons, ['DIVINE_DOGS'], 'it refreshes one summon');
});

test('Mahoraga requires below 70 HP, waits three enemy responses, then replaces Megumi at 50 HP', () => {
  let state = createBattle('megumi', 'toji');
  let result;
  assert.equal(unavailableReason(state, 0, 'MAHORAGA'), 'Requires less than 70 HP');
  state.sides[0].hp = 70;
  assert.equal(unavailableReason(state, 0, 'MAHORAGA'), 'Requires less than 70 HP');
  state.sides[0].hp = 69;
  state = round(state, 'MAHORAGA', 'GUARD', high).state;
  assert.equal(state.sides[0].summonCountdown, 3);
  result = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', high); state = result.state;
  assert.equal(state.sides[0].summonCountdown, 2);
  state = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', high).state;
  assert.equal(state.sides[0].summonCountdown, 1);
  state.sides[1].stunned = true;
  result = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', high); state = result.state;
  assert.equal(state.sides[0].mahoraga, true);
  assert.equal(state.sides[0].hp, 50, 'takes over after the third enemy response');
  assert.equal(state.sides[0].maxHp, 50);
  assert.equal(state.sides[0].adaptation, 0.2);
  assert.ok(eventTexts(result.events).includes('Sacred treasure: Swing and ring...'));
  assert.equal(state.sides[1].hp, 150, 'Mahoraga attacks after taking over at the end of the third response');
  assert.equal(moveOptions(state, 0)[0].name, 'Mahoraga Strike');
  state = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', high).state;
  assert.equal(state.sides[0].hp, 35, 'Toji bypasses Mahoraga’s damage reduction');
  assert.equal(state.sides[1].hp, 120, 'Mahoraga’s own strike deals 30 damage each action');

  state = createBattle('megumi', 'toji');
  state.sides[0].hp = 69;
  state = round(state, 'MAHORAGA', 'BASIC_PUNCH', () => 0.1).state;
  assert.equal(state.sides[0].summonCountdown, 2, 'the response after the summon counts even when Megumi wins initiative');
  state = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', () => 0.1).state;
  assert.equal(state.sides[0].summonCountdown, 1);
  state = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', () => 0.1).state;
  assert.equal(state.sides[0].mahoraga, true, 'takeover follows exactly three enemy responses');
});

test('Mahoraga starts at 20% reduction and loses 4 percentage points each turn', () => {
  assert.equal(BASE.mahoragaHp, 50);
  assert.equal(BASE.adaptStep, 0.04);
  const state = createBattle('megumi', 'ryu');
  state.sides[0].mahoraga = true; state.sides[0].hp = 50; state.sides[0].maxHp = 50; state.sides[0].adaptation = 0.20;
  const first = round(state, 'BASIC_PUNCH', 'GRANITE_BLAST', high).state;
  assert.equal(first.sides[0].adaptation, 0.20, 'the full first turn keeps its starting reduction');
  assert.equal(first.sides[0].hp, 26, '30 incoming damage is reduced by 20% on turn one');
  const second = round(first, 'BASIC_PUNCH', 'GRANITE_BLAST', high).state;
  assert.equal(second.sides[0].adaptation, 0.16, 'turn two falls by 4 percentage points');
  const third = round(second, 'BASIC_PUNCH', 'GRANITE_BLAST', high).state;
  assert.equal(third.sides[0].adaptation, 0.12, 'turn three falls by another 4 percentage points');
});

test('Guard protects against an attack even when the attacker resolves first', () => {
  const priority = MOVES.GUARD.priority;
  MOVES.GUARD.priority = 0;
  try {
    const result = round(createBattle('gojo', 'toji'), 'BASIC_PUNCH', 'GUARD', () => 0.1);
    assert.equal(result.state.sides[1].hp, 200);
    assert.equal(result.state.sides[0].ce, 10, 'a blocked punch gives the attacker double its usual meter');
    assert.ok(eventTexts(result.events).includes('Toji Fushiguro blocked it!'));

    const technique = round(createBattle('gojo', 'toji'), 'AMPLIFICATION_BLUE', 'GUARD', high);
    assert.equal(technique.state.sides[0].ce, 40, 'a blocked technique gives double its usual meter');
  } finally {
    MOVES.GUARD.priority = priority;
  }
});

test('Sukuna starts at 175 HP, eats a finger every third turn, and Cleave scales with fingers', () => {
  let state = createBattle('sukuna', 'toji');
  assert.equal(state.sides[0].hp, 175);
  for (let i = 0; i < 3; i++) state = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', high).state;
  assert.equal(state.sides[0].fingers, 1);
  assert.equal(state.sides[0].maxHp, 185);
  assert.equal(state.sides[0].hp, 140, 'three Toji punches, then finger healing');
  assert.equal(state.sides[0].ce, 25, 'punch meter plus the finger bonus');
  state = round(state, 'CLEAVE', 'BASIC_PUNCH', high).state;
  assert.equal(state.sides[1].hp, 160, 'Cleave deals 15 + 10 per finger');
  assert.equal(unavailableReason(state, 0, 'CLEAVE'), 'Cooldown: 2 turn(s) remaining');
  state.sides[0].ce = 150;
  const shrine = round(state, 'SUKUNA_ULTIMATE', 'BASIC_PUNCH', high);
  assert.equal(shrine.state.sides[0].ce, 0);
  assert.equal(shrine.state.sides[1].hp, 85, 'Malevolent Shrine at 150 meter deals 75');
});

test('Choso stacks actual HP loss, Piercing Blood reads recent summons, and Supernova forces a wipe turn', () => {
  let state = createBattle('choso', 'toji');
  let result = round(state, 'BASIC_PUNCH', 'CURSED_TOOLS', middle);
  state = result.state;
  assert.equal(state.sides[0].hp, 165);
  assert.equal(state.sides[0].bloodStacks, 3);
  assert.equal(state.sides[0].bloodDamageRemainder, 5);
  assert.ok(result.events.some((e) => e.type === 'blood-stack'));

  state = createBattle('choso', 'megumi');
  state.sides[1].lastShikigamiTurn = state.turn;
  result = round(state, 'PIERCING_BLOOD', 'BASIC_PUNCH', high);
  assert.equal(result.state.sides[1].hp, 165, '20 damage plus 15 for the recent summon');

  state = createBattle('choso', 'toji');
  state.sides[0].ce = 100; state.sides[0].bloodStacks = 2;
  result = round(state, 'CHOSO_ULTIMATE', 'BASIC_PUNCH', high);
  state = result.state;
  assert.equal(state.sides[1].hp, 160, 'Toji ignores Supernova’s passive blood damage; Supernova deals 40 direct damage');
  assert.equal(state.sides[0].bloodStacks, 0, 'Supernova consumes stacks');
  assert.equal(state.sides[1].bloodBlindTurns, 1);
  assert.equal(state.sides[1].bleedingTurns, 2, 'Supernova applies two ticks after it is used');
  result = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', high);
  assert.ok(result.events.some((e) => e.text.includes('spends the turn wiping blood')));
  assert.ok(result.events.some((e) => e.text.includes('Supernova blood damage')));
});

test('Ryu Granite Blast has its own damage, meter, decay and cooldown; Way Too Sweet heals and resets it', () => {
  let state = createBattle('ryu', 'toji');
  let result = round(state, 'GRANITE_BLAST', 'BASIC_PUNCH', high);
  state = result.state;
  assert.equal(state.sides[1].hp, 170, 'Granite Blast starts at 30');
  assert.equal(state.sides[0].graniteDamage, 25);
  assert.equal(state.sides[0].ce, 15);
  assert.equal(unavailableReason(state, 0, 'GRANITE_BLAST'), 'Cooldown: 1 turn(s) remaining');
  state = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', high).state;
  assert.equal(unavailableReason(state, 0, 'GRANITE_BLAST'), null);
  state.sides[0].hp = 100; state.sides[0].graniteDamage = 5; state.sides[0].ce = 100;
  result = round(state, 'RYU_ULTIMATE', 'BASIC_PUNCH', high);
  assert.equal(result.state.sides[0].hp, 125, 'Toji’s punch lands before Ryu heals 40');
  assert.equal(result.state.sides[0].graniteDamage, 30);
  assert.equal(result.state.sides[0].ce, 0);
  assert.ok(eventTexts(result.events).some((t) => t.startsWith('Way Too Sweet!')));
});

test('Supernova deals 2 damage per consumed stack on each of the next two turns', () => {
  const state = createBattle('choso', 'yuta');
  state.sides[0].ce = 100; state.sides[0].bloodStacks = 3;
  const cast = round(state, 'CHOSO_ULTIMATE', 'GUARD', high);
  assert.equal(cast.state.sides[1].supernovaBleedDamage, 6);
  assert.equal(cast.state.sides[1].bleedingTurns, 2);
  let tick = round(cast.state, 'BASIC_PUNCH', 'BASIC_PUNCH', high);
  assert.ok(tick.events.some(event => event.type === 'bleed-tick' && event.amount === 6));
  assert.equal(tick.state.sides[1].bleedingTurns, 1);
  tick = round(tick.state, 'BASIC_PUNCH', 'BASIC_PUNCH', high);
  assert.ok(tick.events.some(event => event.type === 'bleed-tick' && event.amount === 6));
  assert.equal(tick.state.sides[1].bleedingTurns, 0);
});

test('Yuji has 33% punch Black Flash, four Straight Hands hits, and takes 33% more Cursed Technique damage only', () => {
  const flash = round(createBattle('yuji', 'ryu'), 'BASIC_PUNCH', 'BASIC_PUNCH', () => 0.1);
  assert.equal(flash.state.sides[1].hp, 180, 'Black Flash doubles the 10-damage punch');
  assert.ok(flash.events.some((e) => e.type === 'black-flash'));
  let state = createBattle('yuji', 'toji');
  state.sides[0].ce = 80;
  const result = round(state, 'YUJI_ULTIMATE', 'BASIC_PUNCH', middle);
  assert.equal(result.state.sides[1].hp, 160, 'four independent 10-damage hits');
  assert.equal(result.state.sides[0].ce, 0);
  assert.equal(unavailableReason(createBattle('yuji', 'toji'), 0, 'YUJI_ULTIMATE'), 'Needs 80 meter');
  const technique = round(createBattle('yuji', 'ryu'), 'BASIC_PUNCH', 'GRANITE_BLAST', high);
  assert.equal(technique.state.sides[0].hp, 160, 'Yuji takes 40 damage from a 30-damage technique');
  const ultimateState = createBattle('gojo', 'yuji');
  ultimateState.sides[0].ce = 100;
  const ultimate = round(ultimateState, 'GOJO_ULTIMATE', 'BASIC_PUNCH', high);
  assert.equal(ultimate.state.sides[1].hp, 160, 'Yuji takes the unmodified 40 damage from an ultimate');
});

test('Cursed Fists deals punch damage, grants 30 meter, and has a 50% Black Flash chance', () => {
  const flash = round(createBattle('yuji', 'ryu'), 'CURSED_FISTS', 'BASIC_PUNCH', () => 0.1);
  assert.equal(flash.state.sides[1].hp, 180);
  assert.equal(flash.state.sides[0].ce, 30);
  assert.ok(flash.events.some(event => event.type === 'black-flash'));
  const normal = round(createBattle('yuji', 'ryu'), 'CURSED_FISTS', 'BASIC_PUNCH', () => 0.6);
  assert.equal(normal.state.sides[1].hp, 190);
  assert.equal(normal.state.sides[0].ce, 30);
  assert.ok(!normal.events.some(event => event.type === 'black-flash'));
});

test('every ultimate ignores Guard', () => {
  const cases = [
    ['gojo', 'GOJO_ULTIMATE'], ['megumi', 'MEGUMI_ULTIMATE'], ['sukuna', 'SUKUNA_ULTIMATE'],
    ['choso', 'CHOSO_ULTIMATE'], ['ryu', 'RYU_ULTIMATE'], ['yuji', 'YUJI_ULTIMATE'],
    ['geto', 'GETO_ULTIMATE'], ['yuta', 'YUTA_ULTIMATE'], ['gojo', 'HOLLOW_PURPLE'],
  ];
  for (const [fighterId, moveId] of cases) {
    const state = createBattle(fighterId, 'toji');
    state.sides[0].ce = 100;
    if (moveId === 'HOLLOW_PURPLE') { state.sides[0].redUses = 2; state.sides[0].blueUses = 2; }
    const result = round(state, moveId, 'GUARD', high);
    assert.ok(!eventTexts(result.events).some(text => text.includes('blocked it!')), `${moveId} should bypass Guard`);
    assert.ok(eventTexts(result.events).some(text => text.includes(`used ${MOVES[moveId].name}!`)), `${moveId} should resolve`);
  }
});

test('Toji has 15-damage punches, random Cursed Tools, and the 100-meter forced skip', () => {
  const punch = round(createBattle('toji', 'gojo'), 'BASIC_PUNCH', 'BASIC_PUNCH', high);
  assert.equal(punch.state.sides[1].hp, 185);
  assert.equal(punch.state.sides[0].ce, 10);
  let state = createBattle('toji', 'gojo');
  const tool = round(state, 'CURSED_TOOLS', 'BASIC_PUNCH', high);
  assert.equal(tool.state.sides[1].hp, 160, 'high uniform roll is 40 after Gojo punches Toji');
  assert.equal(unavailableReason(tool.state, 0, 'CURSED_TOOLS'), 'Cooldown: 2 turn(s) remaining');
  state = createBattle('toji', 'gojo');
  state.sides[0].ce = 100;
  const purge = round(state, 'BASIC_PUNCH', 'GUARD', high);
  assert.equal(purge.state.sides[0].hp, 180);
  assert.equal(purge.state.sides[0].ce, 0);
  assert.ok(eventTexts(purge.events).some((t) => t.includes('loses his turn')));
});

test('Geto’s Curse Army grades and Curse Swallow work; Uzumaki rolls its ten spirits', () => {
  let state = createBattle('geto', 'ryu');
  let result = round(state, 'GUARD', 'BASIC_PUNCH', () => 0.5);
  state = result.state;
  assert.equal(state.sides[1].hp, 190, 'middle roll is Grade 2 and deals 10');
  assert.equal(state.sides[0].ce, 10, 'Grade 2 also gains 10 meter');
  assert.equal(state.sides[0].curseGrade, '2');
  assert.ok(result.events.some((e) => e.type === 'passive' && e.passive === 'Curse Army'));

  state = createBattle('geto', 'toji');
  state.sides[0].hp = 100; state.sides[0].ce = 50;
  result = round(state, 'CURSE_SWALLOW', 'BASIC_PUNCH', high);
  assert.equal(result.state.sides[0].hp, 115, 'Toji hits before the 30 HP heal');
  assert.equal(result.state.sides[0].cursePause, 2);
  assert.equal(unavailableReason(result.state, 0, 'CURSE_SWALLOW'), 'Cooldown: 2 turn(s) remaining');

  state = createBattle('geto', 'toji'); state.sides[0].ce = 100;
  result = round(state, 'GETO_ULTIMATE', 'BASIC_PUNCH', high);
  assert.equal(result.state.sides[0].ce, 0);
  assert.ok(result.events.some((e) => e.text.startsWith('Uzumaki spirits:')));
  assert.ok(result.events.some((e) => e.text.includes('Maximum: Uzumaki dealt')));
});

test('Uzumaki damage above 100 is not halved', () => {
  const state = createBattle('geto', 'toji'); state.sides[0].ce = 100;
  const grades = [...Array(8).fill(0.7), 0.95, 0.95];
  const randomValues = [0.9, 0.5, 0.9, 0.9, ...grades]; let index = 0;
  const result = round(state, 'GETO_ULTIMATE', 'BASIC_PUNCH', () => randomValues[index++] ?? 0.9);
  const roll = result.events.find(event => event.text.startsWith('Uzumaki spirits:'));
  assert.equal(roll.amount, 320, 'eight Grade 1 spirits and two Specials yield 320 full damage');
});

test('Yuta’s Rika transfers meter and Copy executes another ultimate at 80% strength', () => {
  let state = createBattle('yuta', 'toji'); state.sides[0].ce = 20; state.sides[1].ce = 10;
  let result = round(state, 'RIKA', 'BASIC_PUNCH', high);
  state = result.state;
  assert.equal(state.sides[1].hp, 180, 'Rika deals 20');
  assert.equal(state.sides[0].ce, 60, 'Rika gives Yuta +20 technique meter, +5 passive, and transfers 15');
  assert.equal(state.sides[1].ce, 5);
  assert.equal(unavailableReason(state, 0, 'RIKA'), 'Cooldown: 2 turn(s) remaining');

  state = createBattle('yuta', 'toji'); state.sides[0].ce = 100;
  // Coin flip .9 puts Toji first; Copy then chooses Gojo's ultimate, which hits at 80%.
  const random = (() => { const values = [0.9, 0.5, 0, 0.5]; let i = 0; return () => values[i++] ?? 0.5; })();
  result = round(state, 'YUTA_ULTIMATE', 'BASIC_PUNCH', random);
  assert.equal(result.state.sides[0].ce, 5, 'Copy spends all meter, then Yuta gains the passive +5');
  assert.equal(result.state.sides[1].hp, 168, 'copied Unlimited Void deals 32 damage');
  assert.equal(result.state.sides[1].voidAttacks, 2, 'copied ultimates keep their secondary effects');
  assert.ok(eventTexts(result.events).includes('Yuta copied Domain Expansion: Unlimited Void.'));
});

test('Toji bypasses passive defenses and passive damage cannot hurt him', () => {
  let state = createBattle('toji', 'gojo'); state.sides[1].ce = 0;
  let result = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', high);
  assert.equal(result.state.sides[1].hp, 185, 'Toji bypasses Gojo’s below-40-meter reduction');
  state = createBattle('megumi', 'toji'); state.sides[0].hp = 49;
  result = round(state, 'BASIC_PUNCH', 'BASIC_PUNCH', () => 0.05);
  assert.equal(result.state.sides[1].hp, 200, 'Shadow Dweller passive damage is ignored by Toji');
  assert.equal(result.state.sides[0].ce, 15, 'the passive and Basic Punch grant Megumi 15 meter');
});
