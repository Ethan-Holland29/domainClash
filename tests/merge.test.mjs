import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import roster from '../server/roster.json' with {type:'json'};
import { Match, rules } from '../server/match.mjs';
import { createGameServer } from '../server/index.mjs';
import { definitionFor, toSignFrame, MergedGestureRecognizer } from '../.test-build/handTracking/MergedGestureRecognizer.js';
import { MoveById } from '../.test-build/combat/MoveCatalog.js';
import { LEARNED_MODEL } from '../.test-build/signs/handTracking/GestureDefinitions.js';
import { analyzeFrame } from '../.test-build/signs/handTracking/HandGeometry.js';

test('all nine fighters have three real techniques, server rules, and recordable signs',()=>{
  assert.equal(roster.length,9);
  for(const c of roster){assert.equal(c.moves.length,3);for(const id of c.moves){assert.ok(MoveById[id]);assert.ok(rules[id]);assert.equal(definitionFor(id).id,id);}}
  assert.equal(definitionFor('PRIMARY_ATTACK').datasetLabel,'CLEAVE');
  assert.equal(definitionFor('DOMAIN_EXPANSION').datasetLabel,'CHIMERA_SHADOW_GARDEN');
  assert.equal(definitionFor('LAPSE_BLUE').taughtOnly,true);
  LEARNED_MODEL.train([]);
  assert.equal(definitionFor('LAPSE_BLUE').evaluate({hands:[],allHands:[]}).score,0);
});

test('camera adapter preserves world geometry and mirrors recognition exactly once',()=>{
  const source={landmarks:[{x:.2,y:.4,z:.1}],worldLandmarks:[{x:.03,y:.1,z:-.02}],score:.95,handedness:'Left'};
  const frame=toSignFrame([source],100,16/9);
  assert.equal(frame.hands[0].landmarks[0].x,.8);
  assert.equal(frame.hands[0].worldLandmarks[0].x,-.03);
  assert.equal(frame.hands[0].handednessScore,.95);
  assert.equal(frame.aspectRatio,16/9);
  assert.equal(source.landmarks[0].x,.2);
});

test('recorded main-format samples enable a custom sign and update its card label',()=>{
  const landmarks=Array.from({length:21},(_,i)=>({x:.3+(i%4)*.025,y:.7-Math.floor(i/4)*.035,z:0}));
  const hands=[{landmarks,worldLandmarks:[],handedness:'Right',handednessScore:.99}];
  const samples=Array.from({length:25},(_,i)=>({label:'LAPSE_BLUE',aspectRatio:4/3,hands,timestamp:1000+i*100}));
  LEARNED_MODEL.train(samples);
  try{
    const analyzed=analyzeFrame({hands,aspectRatio:4/3,timestampMs:0});
    assert.ok(definitionFor('LAPSE_BLUE').evaluate({hands:analyzed,allHands:analyzed}).score>=.7);
    const r=new MergedGestureRecognizer();r.setMoves(['LAPSE_BLUE']);
    assert.match(MoveById.LAPSE_BLUE.short,/Learned sign.*25 samples/);
  }finally{LEARNED_MODEL.train([]);}
});

test('merged recognizer confirms once, preserves latch after a stall, and requires release',()=>{
  const r=new MergedGestureRecognizer();let score=1;const fired=[];
  r.core.setDefinitions([{id:'LAPSE_BLUE',datasetLabel:'LAPSE_BLUE',name:'Blue',action:'PRIMARY_ATTACK',sign:'test',evaluate:()=>({score,checks:[]})}]);
  r.onConfirmed(id=>fired.push(id));
  for(let t=0;t<=1000;t+=50)r.update([],50,t);
  assert.deepEqual(fired,['LAPSE_BLUE']);
  r.suspend();for(let t=1500;t<=2500;t+=50)r.update([],50,t);
  assert.equal(fired.length,1);
  score=0;for(let t=2550;t<=3000;t+=50)r.update([],50,t);
  score=1;for(let t=3050;t<=4100;t+=50)r.update([],50,t);
  assert.equal(fired.length,2);
});

test('a long inference gap cancels incomplete sign holds',()=>{
  const r=new MergedGestureRecognizer();let fired=0;
  r.core.setDefinitions([{id:'LAPSE_BLUE',datasetLabel:'LAPSE_BLUE',name:'Blue',action:'PRIMARY_ATTACK',sign:'test',evaluate:()=>({score:1,checks:[]})}]);
  r.onConfirmed(()=>fired++);r.update([],0,0);r.update([],50,50);r.update([],250,2000);
  assert.equal(fired,0);
});

test('server locks fighter at Ready and rejects another fighter’s moves without spending energy',()=>{
  const m=new Match(0);m.join(0);
  assert.equal(m.select(0,'no-such-fighter'),'Unknown character');
  assert.equal(m.select(0,'gojo'),null);assert.equal(m.select(1,'sukuna'),null);
  m.ready(0,0);assert.equal(m.select(0,'sukuna'),'Character is locked');m.ready(1,0);m.tick(3000);
  assert.match(m.cast(0,'MALEVOLENT_SHRINE',3000),/does not belong/);
  assert.equal(m.players[0].energy,100);assert.equal(m.cast(0,'LAPSE_BLUE',3000),null);
  m.tick(3180);assert.equal(m.players[1].hp,93);assert.equal(m.snapshot(1).players[0].characterId,'gojo');
});

test('HTTP and WebSocket clients share fighter identities, countdown, attacks, and leave result',async()=>{
  const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const call=async(route,body,token)=>{const response=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
  let ws;
  try{
    const a=(await call('create',{})).data,b=(await call('join',{code:a.code})).data;
    assert.equal((await call('ready',{},a.token)).status,409);
    assert.equal((await call('character',{id:'gojo'},a.token)).status,200);
    ws=new WebSocket(base.replace('http','ws')+'/api/live');await once(ws,'open');
    const messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));
    ws.send(JSON.stringify({type:'auth',token:b.token}));
    const waitFor=async predicate=>{const end=Date.now()+7000;while(Date.now()<end){const found=messages.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,20));}throw Error('Network message timed out');};
    await waitFor(m=>m.type==='connected');
    ws.send(JSON.stringify({type:'character',body:{id:'sukuna'},requestId:1}));assert.equal((await waitFor(m=>m.requestId===1)).error,null);
    await call('ready',{},a.token);ws.send(JSON.stringify({type:'ready',body:{},requestId:2}));
    await waitFor(m=>m.type==='state'&&m.state.phase==='playing');
    assert.equal((await call('cast',{id:'LAPSE_BLUE'},a.token)).status,200);
    ws.send(JSON.stringify({type:'cast',body:{id:'UNLIMITED_VOID'},requestId:3}));
    assert.match((await waitFor(m=>m.requestId===3)).error,/does not belong/);
    const hit=await waitFor(m=>m.type==='state'&&m.state.players[1]?.hp===93);
    assert.equal(hit.state.players[0].characterId,'gojo');assert.equal(hit.state.players[1].characterId,'sukuna');
    await call('leave',{},a.token);const finish=await waitFor(m=>m.type==='state'&&m.state.phase==='finished');assert.equal(finish.state.winner,1);
  }finally{ws?.terminate();await new Promise(r=>server.close(r));}
});
