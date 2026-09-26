import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VfxBudget,VFX_LIMITS} from '../src/effects/VfxBudget.ts';
import {moveLook,BLACK_FLASH_LOOK} from '../src/effects/MovePalette.ts';
import {CombatManager} from '../src/combat/CombatManager.ts';
import {CHARACTERS} from '../src/characters/Characters.ts';
import {Match} from '../server/match.mjs';

test('simultaneous domain effects cannot exceed the shared or per-player particle limit',()=>{
 const budget=new VfxBudget();
 for(let i=0;i<20;i++){budget.claim(i%2,'high');assert.ok(budget.total<=VFX_LIMITS.global);assert.ok(budget.local<=VFX_LIMITS.perPlayer);assert.ok(budget.remote<=VFX_LIMITS.perPlayer);}
 budget.release(0);budget.release(1);assert.equal(budget.total,0);
});
test('slow VFX frames lower density; hidden-tab gaps do not; recovery is gradual',()=>{
 const budget=new VfxBudget();for(let i=0;i<100;i++)budget.sample(2000);assert.equal(budget.quality,1);
 for(let i=0;i<16;i++)budget.sample(40);assert.ok(budget.quality<.5);
 assert.ok(budget.claim(0,'high')<VFX_LIMITS.high/2);
 const low=budget.quality;for(let i=0;i<239;i++)budget.sample(16);assert.equal(budget.quality,low);
 budget.sample(16);assert.ok(budget.quality>low&&budget.quality<1);
});
test('Toji has weapon effects but no personal charge aura; Red and Blue differ by palette and motion',()=>{
 assert.equal(moveLook('BASIC_PUNCH','toji').aura,false);assert.equal(moveLook('CURSED_TOOLS','toji').aura,false);
 assert.equal(moveLook('BASIC_PUNCH','yuji').aura,true);
 assert.equal(moveLook('REVERSAL_RED').color,'#FF1E3C');assert.equal(moveLook('AMPLIFICATION_BLUE').shape,'attract');
 assert.equal(BLACK_FLASH_LOOK.shape,'fracture');
});
test('Black Flash VFX follows the actual combat roll, never a client-provided claim',()=>{
 const yuji=CHARACTERS.find(c=>c.id==='yuji'),ryu=CHARACTERS.find(c=>c.id==='ryu');
 const m=new CombatManager(yuji,()=>.2,'human');m.reset(yuji,ryu);m.start();let flashes=0;m.onBlackFlash=()=>flashes++;
 m.attack('BASIC_PUNCH');assert.equal(m.lastCastBlackFlash,true);assert.equal(flashes,1);
 m.attackFrom(1,'BASIC_PUNCH');assert.equal(m.lastCastBlackFlash,false);
 const room=new Match(0);room.join(0);room.ready(0,0,{round:1});room.ready(1,0,{round:1});room.tick(3000);
 room.cast(0,'BASIC_PUNCH',3000,{round:1,blackFlash:true});assert.equal(room.events.find(e=>e.type==='cast').blackFlash,false);
});
