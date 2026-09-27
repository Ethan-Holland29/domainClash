import test from 'node:test';
import assert from 'node:assert/strict';
import {SelectionModel} from '../.test-build/progress/characters/SelectionModel.js';
import {Match,RESULT_MS} from '../server/match.mjs';

test('hover previews cannot overwrite a clicked or confirmed fighter',()=>{
 const s=new SelectionModel();assert.equal(s.hover('sukuna'),true);s.pick('megumi');
 assert.equal(s.hover('gojo'),false);assert.equal(s.preview,'megumi');
 s.pick('yuta');assert.equal(s.confirm(),'yuta');s.pick('gojo');s.hover('sukuna');assert.equal(s.preview,'yuta');
 s.unlock();assert.equal(s.hover('gojo'),true);
});
test('private preview is shared without changing a pick, and confirm locks both preview and character',()=>{
 const m=new Match(0);m.requireCharacter=true;m.join(0);m.select(0,'gojo');m.select(1,'sukuna');m.preview(0,'yuta');
 assert.equal(m.snapshot(1).players[0].previewId,'yuta');assert.equal(m.players[0].characterId,'gojo');
 m.ready(0,0);assert.match(m.select(0,'yuta'),/locked/);assert.match(m.preview(0,'megumi'),/locked/);
 assert.equal(m.phase,'waiting');m.ready(1,0);assert.equal(m.phase,'countdown');assert.match(m.select(1,'gojo'),/locked/);
});
test('both players receive the same winner and return deadline, then unlock in the same room',()=>{
 const m=new Match(0);m.join(0);m.select(0,'gojo');m.select(1,'sukuna');m.ready(0,0);m.ready(1,0);m.tick(3000);
 m.finish(1,'Knockout');const a=m.snapshot(0),b=m.snapshot(1);
 assert.equal(a.winner,b.winner);assert.equal(a.winner,1);assert.notEqual(a.seat,b.seat);assert.equal(a.returnAt,b.returnAt);
 m.tick(3000+RESULT_MS-1);assert.equal(m.phase,'finished');m.tick(3000+RESULT_MS);assert.equal(m.phase,'waiting');
 assert.equal(m.round,2);assert.ok(m.players.every(p=>!p.ready));assert.equal(m.battle,null);
 assert.equal(m.select(0,'yuta'),null);assert.equal(m.select(1,'megumi'),null);
 m.ready(0,m.now);m.ready(1,m.now);assert.equal(m.phase,'countdown');assert.equal(m.winner,null);
});
test('a departed host frees P1 for a new guest while P2 keeps their seat',()=>{
 const m=new Match(0);m.join(0);m.leave(0);m.tick(RESULT_MS);
 assert.equal(m.players[0],null);assert.ok(m.players[1]);assert.equal(m.join(RESULT_MS),null);assert.equal(m.lastJoinedSeat,0);
 assert.equal(m.players[0].ready,false);
});
test('tracking diagnostics reject malformed values and never publish landmark data',()=>{
 const m=new Match(0);assert.equal(m.tracking(0,{hands:2,fps:30,landmarks:['private']}),null);
 assert.deepEqual(m.snapshot(0).players[0].tracking,{hands:2,fps:30,at:0});
 for(const body of [{hands:3,fps:30},{hands:1,fps:NaN},{hands:1,fps:Infinity},{hands:-1,fps:20}])assert.ok(m.tracking(0,body));
});
