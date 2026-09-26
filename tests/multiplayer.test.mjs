import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {Match} from '../server/match.mjs';
import {createGameServer} from '../server/index.mjs';

function match(){const m=new Match(0);m.join(0);m.select(0,{id:'ryu',round:1});m.select(1,{id:'choso',round:1});m.ready(0,0,{round:1});m.ready(1,0,{round:1});m.tick(3000);m.game.random=()=>.99;return m;}
test('both confirmations required; roster and illegal kits locked during battle',()=>{
 const m=new Match(0);assert.match(m.ready(0,0,{round:1}),/Waiting/);m.join(0);
 assert.equal(m.select(0,{id:'ryu',round:1}),null);assert.equal(m.ready(0,0,{round:1}),null);assert.equal(m.phase,'waiting');
 assert.match(m.select(0,{id:'gojo',round:1}),/confirmed/);m.ready(1,0,{round:1});assert.equal(m.phase,'countdown');
 assert.match(m.cast(0,'GRANITE_BLAST',2000,{round:1}),/start/);m.tick(3000);
 assert.match(m.select(1,{id:'sukuna',round:1}),/locked/);assert.match(m.cast(0,'CLEAVE',3000,{round:1}),/Not available/);
 assert.match(m.cast(1,'BASIC_PUNCH',3000,{round:1}),/turn/);
});
test('human P2 never runs bot AI; authoritative attacks and shared one-second gate',()=>{
 const m=match();assert.equal(m.cast(0,'GRANITE_BLAST',3000,{round:1}),null);const hp=m.game.player.hp;
 m.tick(8000);assert.equal(m.game.player.hp,hp);assert.equal(m.game.turn,'enemy');
 assert.equal(m.cast(1,'BASIC_PUNCH',8000,{round:1}),null);
 assert.equal(m.cast(0,'BASIC_PUNCH',8000,{round:1}),null);
 assert.match(m.cast(1,'BASIC_PUNCH',8100,{round:1}),/one second/);
 assert.equal(m.cast(1,'BASIC_PUNCH',9000,{round:1}),null);
});
test('knockout returns both players to fresh selection; delayed previous-round messages rejected',()=>{
 const m=match();m.game.opponent.hp=1;assert.equal(m.cast(0,'BASIC_PUNCH',3000,{round:1}),null);
 assert.equal(m.phase,'finished');assert.equal(m.winner,0);m.tick(8000);
 assert.equal(m.phase,'waiting');assert.equal(m.round,2);assert.equal(m.game,null);assert.ok(m.players.every(p=>!p.ready));assert.equal(m.waitingSince,8000);
 assert.match(m.ready(0,8000,{round:1}),/changed/);assert.match(m.select(0,{id:'gojo',round:1}),/earlier/);
 assert.match(m.cast(0,'BASIC_PUNCH',8000,{round:1}),/earlier/);
 assert.equal(m.select(0,{id:'gojo',round:2}),null);m.ready(0,8000,{round:2});m.ready(1,8000,{round:2});m.tick(11000);
 assert.equal(m.phase,'playing');assert.equal(m.game.player.hp,200);assert.equal(m.game.player.character.id,'gojo');
});
test('disconnects settle winner, expire seats and reject subsequent updates',()=>{
 const m=match();m.players[0].lastSeen=21000;m.tick(21000);
 assert.equal(m.phase,'finished');assert.equal(m.winner,0);assert.equal(m.players[1],null);
 assert.match(m.telemetry(1,{hands:1}),/expired/);m.tick(26000);assert.equal(m.phase,'finished');
});
test('snapshots serialize combat sets and maps, never share live game mutations',()=>{
 const m=match();const snap=JSON.parse(JSON.stringify(m.snapshot(1)));
 assert.ok(Array.isArray(snap.game.player.usedSummons));assert.ok(Array.isArray(snap.game.player.cooldowns));
 snap.game.player.hp=0;assert.equal(m.game.player.hp,200);
 m.telemetry(0,{hands:999,fps:-20,camera:'true'});assert.deepEqual(m.players[0].telemetry,{hands:2,fps:0,camera:false});
});
test('HTTP and authenticated WebSocket share selection; outsider access is rejected',async()=>{
 const server=createGameServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;let ws;
 const request=async(route,body,token)=>fetch(base+'/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await request('state')).status,401);
  const a=await (await request('create',{})).json(),b=await(await request('join',{code:a.code})).json();
  assert.equal((await request('join',{code:a.code})).status,409);
  ws=new WebSocket(base.replace('http:','ws:')+'/api/live');await once(ws,'open');
  const messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw.toString())));ws.send(JSON.stringify({type:'auth',token:a.token}));
  await new Promise((resolve,reject)=>{const deadline=setTimeout(()=>reject(Error('No live state')),2500);const check=setInterval(()=>{if(messages.some(m=>m.type==='state')){clearInterval(check);clearTimeout(deadline);resolve();}},20);});
  assert.equal((await request('select',{id:'yuta',round:1},b.token)).status,200);
  assert.equal((await request('ready',{round:1},a.token)).status,200);
  assert.equal((await request('select',{id:'geto',round:1},a.token)).status,409);
  const state=await(await request('state',undefined,a.token)).json();assert.equal(state.players[1].characterId,'yuta');assert.equal(state.seat,0);
  assert.equal((await request('leave',{},b.token)).status,200);assert.equal((await request('state',undefined,b.token)).status,401);
 }finally{ws?.terminate();for(const client of server.realtime.clients)client.terminate();await new Promise(resolve=>server.close(resolve));}
});
