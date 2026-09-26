import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const dir = mkdtempSync(join(tmpdir(), 'domainclash-combat-'));
const program = ts.createProgram(['src/progress/combat/CombatManager.ts', 'src/progress/characters/Characters.ts'], {target:ts.ScriptTarget.ES2023, module:ts.ModuleKind.CommonJS, outDir:dir, skipLibCheck:true});
const emitted = program.emit();
assert.equal(emitted.emitSkipped, false);
writeFileSync(join(dir, 'package.json'), '{"type":"commonjs"}');
const require = createRequire(import.meta.url);
const { CombatManager } = require(join(dir, 'combat/CombatManager.js'));
const { CHARACTERS } = require(join(dir, 'characters/Characters.js'));
after(() => rmSync(dir, { recursive:true, force:true }));
const character = id => CHARACTERS.find(c => c.id === id);
function match(id='gojo', enemy='choso') {
  let roll = .99;
  const m = new CombatManager(character(id), () => roll);
  m.reset(character(id), character(enemy)); m.start();
  return { m, rng: value => { roll = value; } };
}
const next = m => m.tick(1500);

test('universal stats, +5 punch, +20 technique, no double input, no real-time attacks', () => {
 const {m} = match(); assert.equal(m.playerHp,200); assert.equal(m.opponentHp,200);
 m.tick(60000); assert.equal(m.playerHp,200);
 assert.equal(m.attack('BASIC_PUNCH'),true); assert.equal(m.meter,5); assert.equal(m.opponentHp,190);
 assert.equal(m.attack('BASIC_PUNCH'),false); next(m); assert.equal(m.playerHp,192);
 assert.equal(m.attack('REVERSAL_RED'),true); assert.equal(m.meter,25); assert.equal(m.opponentHp,170);
});
test('miss boundaries consume turns and retain meter; illegal inputs do nothing', () => {
 const {m,rng}=match(); assert.equal(m.attack('NUE'),false); assert.equal(m.meter,0);
 rng(.099); m.attack('BASIC_PUNCH'); assert.equal(m.opponentHp,200); assert.equal(m.meter,5);
 rng(.99); next(m); rng(.049); m.attack('REVERSAL_RED'); assert.equal(m.opponentHp,200); assert.equal(m.meter,25);
 rng(.99); next(m); rng(.05); m.attack('AMPLIFICATION_BLUE'); assert.equal(m.opponentHp,190);
});
test('Gojo Limitless only below 40 meter; Blue drains enemy meter', () => {
 const {m}=match(); m.player.meter=35; m.attack('BASIC_PUNCH'); next(m); assert.equal(m.playerHp,190);
 m.player.meter=0; m.opponent.meter=30; m.attack('AMPLIFICATION_BLUE'); assert.equal(m.opponent.meter,10); next(m); assert.equal(m.playerHp,182);
});
test('Void affects exactly two attacks and deals fixed self damage on a proc', () => {
 const {m,rng}=match(); m.player.meter=100; m.attack('GOJO_ULTIMATE'); assert.equal(m.meter,0); assert.equal(m.opponentHp,160);
 rng(.2); next(m); assert.equal(m.opponentHp,155); assert.equal(m.playerHp,200); assert.equal(m.opponent.voidAttacks,1);
 rng(.99); m.attack('BASIC_PUNCH'); next(m); assert.equal(m.opponent.voidAttacks,0); assert.equal(m.playerHp,192);
});
test('Purple unlocks after two uses of each and skips exactly three later turns', () => {
 const {m}=match(); assert.match(m.unavailable('HOLLOW_PURPLE'),/Unlock/);
 for(const action of ['REVERSAL_RED','AMPLIFICATION_BLUE','BASIC_PUNCH','BASIC_PUNCH','REVERSAL_RED','AMPLIFICATION_BLUE']) { m.attack(action); next(m); }
 assert.equal(m.meter,90); assert.match(m.unavailable('HOLLOW_PURPLE'),/100/);
 m.opponent.hp=200; m.player.meter=100; const hp=m.opponentHp; m.attack('HOLLOW_PURPLE'); assert.equal(m.opponentHp,hp-100); assert.equal(m.meter,0);
 for(let i=3;i>0;i--) { next(m); assert.equal(m.player.recovery,i); assert.equal(m.attack('BASIC_PUNCH'),false); next(m); }
 next(m); assert.equal(m.player.recovery,0); assert.equal(m.turn,'player'); assert.equal(m.attack('BASIC_PUNCH'),true);
});
test('Dogs heal up to cap, bite three turns alongside attacks, and cannot repeat', () => {
 const {m}=match('megumi'); m.player.hp=190; m.attack('DIVINE_DOGS'); assert.equal(m.playerHp,200); assert.equal(m.opponentHp,195);
 assert.equal(m.player.dogsTurns,2); next(m); assert.match(m.unavailable('DIVINE_DOGS'),/Already/);
 m.attack('BASIC_PUNCH'); next(m); m.attack('BASIC_PUNCH'); assert.equal(m.opponentHp,165); assert.equal(m.player.dogsTurns,0);
 next(m); m.attack('BASIC_PUNCH'); assert.equal(m.opponentHp,155);
});
test('Nue supports all four equal-probability damage outcomes', () => {
 for(const [roll,damage] of [[.1,15],[.3,20],[.6,30],[.9,5]]) {
  const {m,rng}=match('megumi'); rng(roll); m.attack('NUE'); assert.equal(m.opponentHp,200-damage); assert.equal(m.meter,20); assert.match(m.unavailable('NUE'),/Already/);
 }
});
test('Megumi domain consumes meter and refreshes one random summon', () => {
 for(const [roll,summon] of [[.2,'NUE'],[.8,'DIVINE_DOGS']]) {
  const {m,rng}=match('megumi'); m.player.meter=100; m.player.usedSummons.add('NUE'); m.player.usedSummons.add('DIVINE_DOGS');
  rng(roll); m.attack('MEGUMI_ULTIMATE'); assert.equal(m.opponentHp,180); assert.equal(m.meter,0); assert.equal(m.player.usedSummons.has(summon),false); assert.equal(m.player.usedSummons.size,1);
 }
});
test('Shadow Dweller rolls once per own turn, grants 10 meter and deals 10', () => {
 const m = new CombatManager(character('megumi'),()=>.05); m.reset(character('megumi'),character('choso')); m.start();
 assert.equal(m.opponentHp,190); assert.equal(m.meter,10); m.tick(10000); assert.equal(m.opponentHp,190);
});
test('Mahoraga threshold, three-turn living delay, 30HP takeover and 30 damage', () => {
 const {m}=match('megumi'); m.player.hp=50; assert.match(m.unavailable('MAHORAGA'),/less than 50/);
 m.player.hp=49; m.attack('MAHORAGA'); assert.equal(m.playerHp,49); assert.equal(m.player.summonCountdown,3);
 next(m); assert.equal(m.playerHp,39); assert.equal(m.player.summonCountdown,2); m.attack('BASIC_PUNCH');
 next(m); assert.equal(m.playerHp,29); assert.equal(m.player.summonCountdown,1); m.attack('BASIC_PUNCH');
 next(m); assert.equal(m.player.mahoraga,true); assert.equal(m.playerHp,30); assert.equal(m.player.adaptation,.5);
 const hp=m.opponentHp; m.attack('BASIC_PUNCH'); assert.equal(m.opponentHp,hp-30); next(m); assert.equal(m.playerHp,25);
 m.attack('BASIC_PUNCH'); next(m); assert.equal(m.playerHp,23);
 m.attack('BASIC_PUNCH'); next(m); assert.equal(m.playerHp,22);
 m.attack('BASIC_PUNCH'); next(m); assert.equal(m.playerHp,22);
});
test('Megumi can lose during delay; Mahoraga loss counts as player loss', () => {
 const {m}=match('megumi'); m.player.hp=9; m.attack('MAHORAGA'); next(m); assert.equal(m.status,'lost');
 const {m:n}=match('megumi'); n.player.mahoraga=true; n.player.hp=5; n.player.adaptation=.5; n.attack('BASIC_PUNCH'); next(n); assert.equal(n.status,'lost');
});
test('AI uses the same Gojo and Megumi rules and can win', () => {
 const {m,rng}=match('sukuna','gojo'); m.opponent.meter=100; m.attack('BASIC_PUNCH'); rng(.99); next(m);
 assert.equal(m.playerHp,135); assert.equal(m.player.voidAttacks,2); assert.equal(m.opponent.meter,0);
 const {m:n}=match('sukuna','megumi'); n.opponent.hp=40; n.attack('BASIC_PUNCH'); next(n); assert.equal(n.opponent.summonCountdown,3);
});
test('reset clears every match effect and terminal states stop further attacks', () => {
 const {m}=match(); m.opponent.hp=10; m.attack('BASIC_PUNCH'); assert.equal(m.status,'won'); assert.equal(m.attack('BASIC_PUNCH'),false);
 m.player.recovery=3; m.player.redUses=2; m.player.voidAttacks=2; m.player.summonCountdown=2; m.player.usedSummons.add('NUE');
 m.reset(character('megumi')); assert.equal(m.playerHp,200); assert.equal(m.meter,0); assert.equal(m.status,'ready'); assert.equal(m.player.usedSummons.size,0); assert.equal(m.player.recovery,0); assert.equal(m.player.summonCountdown,null); assert.equal(m.player.voidAttacks,0); assert.equal(m.log.length,0);
});

test('Mahoraga victory belongs to Megumi and meter stays capped', () => {
 const {m}=match('megumi'); m.player.mahoraga=true; m.player.hp=30; m.player.adaptation=.5; m.opponent.hp=30;
 m.attack('BASIC_PUNCH'); assert.equal(m.status,'won'); assert.equal(m.meter,0);
 const {m:n}=match(); n.player.meter=99; n.attack('BASIC_PUNCH'); assert.equal(n.meter,100);
});
test('missed summons spend their one use and do not heal or start effects', () => {
 const {m,rng}=match('megumi'); m.player.hp=100; rng(.01); m.attack('DIVINE_DOGS');
 assert.equal(m.playerHp,100); assert.equal(m.player.dogsTurns,0); assert.equal(m.player.usedSummons.has('DIVINE_DOGS'),true);
});
test('the opponent also benefits from Shadow Dweller and Limitless', () => {
 const {m,rng}=match('sukuna','megumi'); rng(.05); m.attack('BASIC_PUNCH'); assert.equal(m.playerHp,165); assert.equal(m.opponent.meter,10);
 const {m:n}=match('sukuna','gojo'); n.attack('BASIC_PUNCH'); assert.equal(n.opponentHp,196);
});

test('default techniques wait two full owner turns, independently of real time', () => {
 for (const [id,action] of [['sukuna','CLEAVE'],['choso','PIERCING_BLOOD']]) {
  const {m}=match(id); assert.equal(m.attack(action),true); next(m);
  for (const remaining of [2,1]) {
   assert.equal(m.remaining(action),remaining); const meter=m.meter;
   assert.equal(m.attack(action),false); assert.equal(m.meter,meter);
   m.tick(90000); assert.equal(m.remaining(action),remaining);
   m.attack('BASIC_PUNCH'); next(m);
  }
  assert.equal(m.remaining(action),0); assert.equal(m.attack(action),true);
 }
});
test('Red and Blue each wait three owner turns; misses start cooldown; reset clears it', () => {
 const {m,rng}=match(); rng(.01); m.attack('REVERSAL_RED'); rng(.99); next(m);
 assert.equal(m.remaining('REVERSAL_RED'),3); assert.equal(m.remaining('AMPLIFICATION_BLUE'),0);
 m.attack('AMPLIFICATION_BLUE'); next(m); assert.equal(m.remaining('REVERSAL_RED'),2); assert.equal(m.remaining('AMPLIFICATION_BLUE'),3);
 m.attack('BASIC_PUNCH'); next(m); m.attack('BASIC_PUNCH'); next(m);
 assert.equal(m.remaining('REVERSAL_RED'),0); assert.equal(m.remaining('AMPLIFICATION_BLUE'),1);
 assert.equal(m.attack('REVERSAL_RED'),true); m.reset(); assert.equal(m.remaining('REVERSAL_RED'),0); assert.equal(m.remaining('AMPLIFICATION_BLUE'),0);
});
test('Megumi summon locks and ultimates are not replaced by timed cooldowns', () => {
 const {m}=match('megumi'); m.attack('NUE'); next(m); assert.equal(m.remaining('NUE'),0); assert.match(m.unavailable('NUE'),/Already/);
 m.player.meter=100; m.attack('MEGUMI_ULTIMATE'); assert.equal(m.remaining('MEGUMI_ULTIMATE'),0);
 const {m:n}=match(); assert.equal(n.cooldownDuration('GOJO_ULTIMATE'),0); assert.equal(n.cooldownDuration('HOLLOW_PURPLE'),0); assert.equal(n.cooldownDuration('BASIC_PUNCH'),0);
});
test('AI obeys the same per-move cooldowns', () => {
 const {m,rng}=match('sukuna','gojo'); rng(.5); m.attack('BASIC_PUNCH'); next(m);
 assert.equal(m.opponent.blueUses,1); assert.equal(m.remaining('AMPLIFICATION_BLUE',m.opponent),3);
 m.attack('BASIC_PUNCH'); next(m); assert.equal(m.opponent.redUses,1); assert.equal(m.opponent.blueUses,1);
 m.attack('BASIC_PUNCH'); next(m); assert.equal(m.opponent.redUses,1); assert.equal(m.opponent.blueUses,1);
});

test('Ryu blast degrades to 5, grants 15 meter and waits one turn', () => {
 const {m}=match('ryu');
 for (const damage of [25,20,15,10,5,5]) {
  m.opponent.hp=200; m.player.hp=200; m.player.meter=0;
  assert.equal(m.attack('GRANITE_BLAST'),true); assert.equal(m.opponentHp,200-damage); assert.equal(m.meter,15);
  next(m); assert.equal(m.remaining('GRANITE_BLAST'),1); assert.equal(m.attack('GRANITE_BLAST'),false);
  m.attack('BASIC_PUNCH'); next(m); assert.equal(m.remaining('GRANITE_BLAST'),0);
 }
 assert.equal(m.player.graniteDamage,5);
});
test('Ryu ultimate heals with a cap and restores blast without damaging the opponent', () => {
 for(const [hp,expected] of [[100,140],[190,200]]) {
  const {m}=match('ryu'); m.player.hp=hp; m.player.graniteDamage=5; m.player.meter=100;
  m.attack('RYU_ULTIMATE'); assert.equal(m.playerHp,expected); assert.equal(m.opponentHp,200); assert.equal(m.player.graniteDamage,25); assert.equal(m.meter,0);
 }
});
test('Ryu misses still decay the blast; missed ultimate does not heal or reset', () => {
 const {m,rng}=match('ryu'); rng(.01); m.attack('GRANITE_BLAST'); assert.equal(m.player.graniteDamage,20); assert.equal(m.opponentHp,200); assert.equal(m.meter,15);
 rng(.99); next(m); m.player.hp=100; m.player.meter=100; rng(.01); m.attack('RYU_ULTIMATE'); assert.equal(m.playerHp,100); assert.equal(m.player.graniteDamage,20); assert.equal(m.meter,0);
});
test('Flowing Red Scale accumulates small actual hits and carries the remainder', () => {
 const {m}=match('choso','sukuna');
 m.attack('BASIC_PUNCH'); next(m); assert.equal(m.playerHp,195); assert.equal(m.player.bloodStacks,0); assert.equal(m.player.bloodDamageRemainder,5);
 m.attack('BASIC_PUNCH'); next(m); assert.equal(m.playerHp,190); assert.equal(m.player.bloodStacks,1); assert.equal(m.player.bloodDamageRemainder,0);
 m.player.voidAttacks=1;
 const {m:n,rng}=match('choso'); n.player.voidAttacks=1; rng(.2); n.attack('PIERCING_BLOOD'); assert.equal(n.playerHp,195); assert.equal(n.player.bloodDamageRemainder,5);
});
test('Supernova consumes stacks, hits for 40 and applies exactly three 5-damage ticks', () => {
 const {m}=match('choso'); m.player.bloodStacks=3; m.player.meter=100;
 m.attack('CHOSO_ULTIMATE'); assert.equal(m.player.bloodStacks,0); assert.equal(m.meter,0); assert.equal(m.opponentHp,155); assert.equal(m.opponent.bleedingTurns,2); assert.equal(m.opponent.bloodBlindTurns,1);
 next(m); assert.equal(m.playerHp,200); assert.equal(m.opponent.bloodBlindTurns,0); assert.equal(m.turn,'player');
 m.attack('BASIC_PUNCH'); assert.equal(m.opponentHp,140); assert.equal(m.opponent.bleedingTurns,1); next(m);
 m.attack('BASIC_PUNCH'); assert.equal(m.opponentHp,125); assert.equal(m.opponent.bleedingTurns,0); next(m);
 m.attack('BASIC_PUNCH'); assert.equal(m.opponentHp,115);
});
test('Supernova blind works without stacks; a miss consumes stacks but adds no effects', () => {
 const {m}=match('choso'); m.player.meter=100; m.attack('CHOSO_ULTIMATE'); assert.equal(m.opponentHp,160); assert.equal(m.opponent.bloodBlindTurns,1); assert.equal(m.opponent.bleedingTurns,0);
 const {m:n,rng}=match('choso'); n.player.meter=100; n.player.bloodStacks=3; rng(.01); n.attack('CHOSO_ULTIMATE'); assert.equal(n.player.bloodStacks,0); assert.equal(n.opponentHp,200); assert.equal(n.opponent.bloodBlindTurns,0); assert.equal(n.opponent.bleedingTurns,0);
});
test('blood damage respects defenses, kills on the affected turn, and freezes action while blinded', () => {
 const {m}=match('choso','gojo'); m.player.meter=100; m.player.bloodStacks=1; m.attack('CHOSO_ULTIMATE'); assert.equal(m.opponentHp,164);
 const {m:n}=match('choso'); n.player.meter=100; n.player.bloodStacks=1; n.opponent.hp=45; n.attack('CHOSO_ULTIMATE'); assert.equal(n.status,'won');
 const {m:p}=match('ryu','choso'); p.opponent.meter=100; p.opponent.bloodStacks=2; p.attack('BASIC_PUNCH'); next(p);
 assert.equal(p.player.bloodBlindTurns,1); assert.equal(p.attack('BASIC_PUNCH'),false); const meter=p.meter; next(p); assert.equal(p.meter,meter); assert.equal(p.player.bloodBlindTurns,0);
});
test('Piercing Blood bonus covers exactly two Megumi turns, only for successful shikigami summons', () => {
 for (const action of ['NUE','DIVINE_DOGS']) {
  const {m}=match('megumi','choso'); m.attack(action); assert.equal(m.player.lastShikigamiTurn,1);
 }
 for (const [last,turn,mahoraga,expected] of [[1,1,false,35],[1,2,false,35],[1,3,false,20],[null,1,false,20],[1,2,true,20]]) {
  const {m}=match('choso','megumi'); m.opponent.lastShikigamiTurn=last; m.opponent.turns=turn; m.opponent.mahoraga=mahoraga;
  m.attack('PIERCING_BLOOD'); assert.equal(m.opponentHp,200-expected);
 }
 const {m,rng}=match('megumi','choso'); rng(.01); m.attack('NUE'); assert.equal(m.player.lastShikigamiTurn,null);
});
test('Sukuna starts at 175, punches for 5, and eats exactly five fingers at three-turn intervals', () => {
 const {m}=match('sukuna'); assert.equal(m.playerHp,175); assert.equal(m.player.maxHp,175);
 for(let turn=1;turn<=16;turn++) {
  const hp=m.playerHp; const opponentHp=m.opponentHp;
  m.attack('BASIC_PUNCH'); assert.equal(m.opponentHp,opponentHp-5);
  assert.equal(m.player.fingers,Math.min(5,Math.floor(turn/3)));
  assert.equal(m.player.maxHp,175+10*Math.min(5,Math.floor(turn/3)));
  assert.equal(m.playerHp,hp+(turn%3===0 && turn<=15 ? 10 : 0));
  next(m);
 }
 assert.equal(m.player.maxHp,225); assert.equal(m.player.fingers,5);
});
test('Cleave grows by 10 per finger; Sukuna meter caps at 150 including finger gains', () => {
 for(const fingers of [0,1,3,5]) {
  const {m}=match('sukuna'); m.player.fingers=fingers; m.attack('CLEAVE'); assert.equal(m.opponentHp,200-(15+10*fingers)); assert.equal(m.meter,20);
 }
 const {m}=match('sukuna'); m.player.turns=3; m.player.meter=149; m.attack('BASIC_PUNCH'); assert.equal(m.meter,150); assert.equal(m.player.fingers,1);
});
test('Malevolent Shrine snapshots and spends all meter at every damage tier', () => {
 for(const [meter,damage] of [[100,45],[119,45],[120,60],[149,60],[150,75]]) {
  const {m}=match('sukuna'); m.player.meter=meter; m.attack('SUKUNA_ULTIMATE'); assert.equal(m.opponentHp,200-damage); assert.equal(m.meter,0);
 }
 const {m}=match('sukuna'); m.player.meter=99; assert.equal(m.attack('SUKUNA_ULTIMATE'),false); assert.equal(m.meter,99);
 const {m:n,rng}=match('sukuna'); n.player.meter=150; rng(.01); n.attack('SUKUNA_ULTIMATE'); assert.equal(n.opponentHp,200); assert.equal(n.meter,0);
});
test('Blue drains Sukuna overcharge; a skipped Sukuna turn still counts toward a finger', () => {
 const {m}=match('gojo','sukuna'); m.opponent.meter=150; m.attack('AMPLIFICATION_BLUE'); assert.equal(m.opponent.meter,130);
 const {m:n}=match('sukuna'); n.player.turns=3; n.player.bloodBlindTurns=1; next(n); assert.equal(n.player.fingers,1); assert.equal(n.playerHp,185); assert.equal(n.meter,10);
});
test('AI uses each new ultimate; reset clears all new state', () => {
 const {m}=match('gojo','ryu'); m.opponent.hp=100; m.opponent.graniteDamage=5; m.opponent.meter=100; m.attack('BASIC_PUNCH'); next(m); assert.equal(m.opponentHp,130); assert.equal(m.opponent.graniteDamage,25);
 const {m:n}=match('choso','sukuna'); n.opponent.meter=150; n.attack('BASIC_PUNCH'); next(n); assert.equal(n.playerHp,125); assert.equal(n.player.bloodStacks,7); assert.equal(n.player.bloodDamageRemainder,5);
 n.player.bleedingTurns=5; n.player.bloodBlindTurns=1; n.reset(character('sukuna')); assert.equal(n.playerHp,175); assert.equal(n.player.maxHp,175); assert.equal(n.player.fingers,0); assert.equal(n.player.bloodStacks,0); assert.equal(n.player.bloodDamageRemainder,0); assert.equal(n.player.bleedingTurns,0); assert.equal(n.player.bloodBlindTurns,0); assert.equal(n.player.graniteDamage,25); assert.equal(n.player.lastShikigamiTurn,null);
});

test('constant passive banners queue Player 1 before Player 2 and reset cleanly', () => {
 const {m}=match('ryu','ryu'); m.showNextPassive();
 assert.equal(m.passivePopup.side,'player'); assert.equal(m.passivePopup.name,'Jane, You’re Early');
 assert.equal(m.log.filter(x=>x==="Your life's work has been dirtied...").length,2);
 m.status='won'; m.tick(2400); assert.equal(m.passivePopup.side,'enemy');
 m.tick(2400); assert.equal(m.passivePopup,null);
 m.reset(); m.showNextPassive(); assert.equal(m.passivePopup,null); assert.deepEqual(m.log,[]);
});
test('Gojo announces entry into Limitless, not each reduced hit', () => {
 const {m}=match('gojo','yuji'); m.showNextPassive(); assert.equal(m.passivePopup.name,'Limitless');
 m.attack('BASIC_PUNCH'); next(m);
 assert.equal(m.log.filter(x=>x==='Satoru Gojo is the Honored One!').length,1);
 m.player.meter=100; m.attack('GOJO_ULTIMATE');
 assert.equal(m.log.filter(x=>x==='Satoru Gojo is the Honored One!').length,2);
 const {m:blue}=match('gojo','gojo'); blue.opponent.meter=50; blue.attack('AMPLIFICATION_BLUE');
 assert.equal(blue.opponent.meter,30);
 assert.equal(blue.log.filter(x=>x==='Satoru Gojo is the Honored One!').length,3);
});
test('simultaneous meter resets queue Player 1 before Player 2', () => {
 const {m}=match('gojo','gojo'); m.showNextPassive(); m.tick(2400); m.tick(2400);
 m.player.meter=100; m.opponent.meter=100; m.attack('GOJO_ULTIMATE'); m.tick(1500); m.showNextPassive();
 assert.equal(m.passivePopup.side,'player');
 m.status='won'; m.tick(2400); assert.equal(m.passivePopup.side,'enemy');
});
test('stack and finger events use exact messages and do not fire on misses', () => {
 const {m,rng}=match('sukuna','choso'); rng(0); m.attack('BASIC_PUNCH'); m.showNextPassive(); assert.equal(m.passivePopup,null);
 rng(.99); next(m); m.attack('CLEAVE'); assert.ok(m.log.includes('Choso is gaining stacks!'));
 next(m); m.attack('BASIC_PUNCH'); assert.ok(m.log.includes('Sukuna is growing stronger...'));
 m.showNextPassive(); m.status='won'; m.tick(2400); assert.equal(m.passivePopup.name,'Finger Lickin’');
});

test('Yuji Black Flash boundary and Straight Hands independently roll four hits at 80 meter', () => {
 const {m,rng}=match('yuji','ryu'); rng(.329); m.attack('BASIC_PUNCH'); assert.equal(m.opponent.hp,180);
 rng(.99); next(m); m.player.meter=79; assert.match(m.unavailable('YUJI_ULTIMATE'),/80/);
 m.player.meter=80; const rolls=[.99,.1,.5,.2,.7]; m.random=()=>rolls.shift()??.99;
 m.attack('YUJI_ULTIMATE'); assert.equal(m.opponent.hp,120); assert.equal(m.player.meter,0);
});
test('Yuji doubles technique damage and reduces ultimates, rounded down', () => {
 const {m}=match('gojo','yuji'); m.attack('REVERSAL_RED'); assert.equal(m.opponent.hp,160);
 next(m); m.player.meter=100; m.attack('GOJO_ULTIMATE'); assert.equal(m.opponent.hp,134);
});
test('Toji punches for 15 and gains 10, bypasses Gojo, then purges automatically', () => {
 const {m}=match('toji','gojo'); m.player.meter=90; m.attack('BASIC_PUNCH'); assert.equal(m.opponent.hp,185); assert.equal(m.player.meter,100);
 next(m); assert.equal(m.player.purge,true); assert.match(m.unavailable('BASIC_PUNCH'),/expel/);
 const before=m.player.hp; next(m); assert.equal(m.player.hp,before-20); assert.equal(m.player.meter,0); assert.equal(m.turn,'enemy');
});
test('Toji ignores passive damage and defense without disabling enemy meter or Sukuna', () => {
 const {m}=match('megumi','toji'); m.random=()=>.05; m.beginTurn('player'); assert.equal(m.opponent.hp,200); assert.equal(m.player.meter,10);
 m.opponent.bleedingTurns=3; m.beginTurn('enemy'); assert.equal(m.opponent.hp,200);
 const {m:g}=match('geto','toji'); g.random=()=>.5; g.beginTurn('player'); assert.equal(g.opponent.hp,200); assert.equal(g.player.meter,60);
 const {m:s}=match('sukuna','toji'); s.player.fingers=2; s.attack('CLEAVE'); assert.equal(s.opponent.hp,165);
 const {m:y,rng}=match('yuji','toji'); rng(.2); y.attack('BASIC_PUNCH'); assert.equal(y.opponent.hp,190);
});
test('Cursed Tools rolls 30/35/40 and enemy pickup lasts one turn only', () => {
 for(const [roll,damage] of [[0,30],[.4,35],[.9,40]]) {
  const {m}=match('toji','yuji'); const rolls=[.99,roll,.99]; m.random=()=>rolls.shift()??.99;
  m.attack('CURSED_TOOLS'); assert.equal(m.opponent.hp,200-damage*2); assert.equal(m.remaining('CURSED_TOOLS'),2);
 }
 const {m}=match('toji','ryu'); const rolls=[.99,.4,.1]; m.random=()=>rolls.shift()??.99;
 m.attack('CURSED_TOOLS'); assert.equal(m.opponent.weaponBonus,10); next(m); assert.equal(m.player.hp,180); assert.equal(m.opponent.weaponBonus,0);
});
test('Geto curse grades have exact boundary effects and guard covers the next enemy turn', () => {
 for(const [roll,damage,meter,guard] of [[.249,5,0,false],[.25,10,10,false],[.649,10,10,false],[.65,0,10,true],[.899,0,10,true],[.9,0,50,false]]) {
  const m=new CombatManager(character('geto'),()=>roll); m.reset(character('geto'),character('ryu')); m.start();
  assert.equal(m.opponent.hp,200-damage); assert.equal(m.player.meter,meter); assert.equal(m.player.curseGuard,guard);
 }
 const {m}=match('geto','ryu'); m.random=()=>.7; m.beginTurn('player'); m.random=()=>.99;
 m.attack('BASIC_PUNCH'); next(m); assert.equal(m.player.hp,194); assert.equal(m.player.curseGuard,false);
});
test('Curse Swallow heals to cap and suppresses exactly the next two summons', () => {
 const {m}=match('geto','ryu'); m.player.hp=185; m.attack('CURSE_SWALLOW'); assert.equal(m.player.hp,200); assert.equal(m.player.cursePause,2);
 next(m); assert.equal(m.player.cursePause,1); assert.equal(m.player.curseGrade,'');
 m.attack('BASIC_PUNCH'); next(m); assert.equal(m.player.cursePause,0); assert.equal(m.player.curseGrade,'');
 m.attack('BASIC_PUNCH'); next(m); assert.equal(m.player.curseGrade,'special');
});
test('Uzumaki adds signed grades then doubles, halves only above 100 and floors at zero', () => {
 const {uzumaki}=require(join(dir,'combat/FinalCharacterRules.js'));
 for (const [roll,damage] of [[.1,50],[.4,0],[.7,100],[.95,0]]) assert.equal(uzumaki(()=>roll).damage,damage);
 const rolls=[.7,.7,.7,.7,.7,.7,.7,.7,.7,.95]; assert.equal(uzumaki(()=>rolls.shift()).damage,90);
 const {m}=match('geto','ryu'); m.player.meter=100; const values=[.99,...Array(10).fill(.1)]; m.random=()=>values.shift()??.99;
 m.attack('GETO_ULTIMATE'); assert.equal(m.opponent.hp,150); assert.equal(m.player.meter,0);
});
test('Yuta gains +5 per attack, Rika steals only available meter and uses normal cooldown', () => {
 const {m}=match('yuta','ryu'); m.attack('BASIC_PUNCH'); assert.equal(m.player.meter,10); next(m);
 m.opponent.meter=7; m.attack('RIKA'); assert.equal(m.player.meter,42); assert.equal(m.opponent.meter,0); assert.equal(m.opponent.hp,170); assert.equal(m.remaining('RIKA'),2);
});
test('Copy covers every eligible ultimate with scaled damage/healing and secondary effects', () => {
 const cases=[['GOJO_ULTIMATE',32],['HOLLOW_PURPLE',80],['MEGUMI_ULTIMATE',24],['SUKUNA_ULTIMATE',44],['CHOSO_ULTIMATE',40],['RYU_ULTIMATE',0],['YUJI_ULTIMATE',32],['GETO_ULTIMATE',0]];
 cases.forEach(([action,damage],i)=>{
  const {m}=match('yuta','ryu'); m.player.meter=100; m.player.hp=100;
  const rolls=[(i+.1)/8,.99]; m.random=()=>rolls.shift()??.99;
  m.attack('YUTA_ULTIMATE'); assert.equal(m.opponent.hp,200-damage,action); assert.equal(m.player.meter,5,action);
  if(action==='GOJO_ULTIMATE') assert.equal(m.opponent.voidAttacks,2);
  if(action==='HOLLOW_PURPLE') assert.equal(m.player.recovery,3);
  if(action==='MEGUMI_ULTIMATE') assert.equal(m.player.borrowedSummons.size,1);
  if(action==='CHOSO_ULTIMATE') assert.equal(m.opponent.bloodBlindTurns,1);
  if(action==='RYU_ULTIMATE') assert.equal(m.player.hp,132);
 });
});
test('copied Chimera summon can actually be used once and cleared on reset', () => {
 const {m}=match('yuta','ryu'); m.player.meter=100; const rolls=[2.1/8,.99,.1]; m.random=()=>rolls.shift()??.99;
 m.attack('YUTA_ULTIMATE'); assert.ok(m.actions().includes('NUE')); next(m); m.attack('NUE'); assert.ok(!m.actions().includes('NUE'));
 m.reset(); assert.equal(m.player.borrowedSummons.size,0);
});
test('new enemy kits choose legal techniques and ultimates', () => {
 for(const [id,ult] of [['yuji','YUJI_ULTIMATE'],['geto','GETO_ULTIMATE'],['yuta','YUTA_ULTIMATE']]) {
  const {m}=match('ryu',id); m.opponent.meter=id==='yuji'?80:100; assert.equal(m.chooseEnemyAction(),ult);
 }
 const {m}=match('ryu','toji'); m.random=()=>.1; assert.equal(m.chooseEnemyAction(),'CURSED_TOOLS');
});
