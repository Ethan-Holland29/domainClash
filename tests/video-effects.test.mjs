import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {WebSocket} from 'ws';
import {createGameServer} from '../server/index.mjs';
import {Match} from '../server/match.mjs';
import {MOVE_LOOKS,validOrigin} from '../src/effects/MovePalette.ts';
import {ALL_GESTURES} from '../src/handTracking/GestureTypes.ts';

test('every move has distinct visuals and sound; regular attacks finish promptly',()=>{
 const ids=[...ALL_GESTURES,'HOLLOW_PURPLE'];assert.equal(Object.keys(MOVE_LOOKS).length,ids.length);
 assert.equal(new Set(ids.map(id=>MOVE_LOOKS[id].shape)).size,ids.length);
 assert.equal(new Set(ids.map(id=>JSON.stringify([MOVE_LOOKS[id].notes,MOVE_LOOKS[id].wave,MOVE_LOOKS[id].noise]))).size,ids.length);
 for(const id of ids){const p=MOVE_LOOKS[id];assert.ok(p.duration<=1400);assert.ok(p.notes.every(n=>n>=30&&n<4000));}
 for(const id of ['CLEAVE','PIERCING_BLOOD','REVERSAL_RED','AMPLIFICATION_BLUE','GRANITE_BLAST'])assert.ok(MOVE_LOOKS[id].duration<=600);
});
test('effect anchors are bounded visual data and appear only on accepted attacks',()=>{
 assert.deepEqual(validOrigin({x:-10,y:5}),{x:0,y:1});assert.equal(validOrigin({x:NaN,y:0}),null);
 const m=new Match(0);m.join(0);m.ready(0,0,{round:1});m.ready(1,0,{round:1});m.tick(3000);
 assert.match(m.cast(1,'BASIC_PUNCH',3000,{round:1,origin:{x:0,y:1}}),/turn/);
 assert.equal(m.events.filter(e=>e.type==='cast').length,0);
 m.cast(0,'BASIC_PUNCH',3000,{round:1,origin:{x:.2,y:.7}});
 const event=m.events.find(e=>e.type==='cast');assert.deepEqual(event.origin,{x:.2,y:.7});assert.equal(event.round,1);assert.equal(event.at,3000);
});
test('live camera relay isolates rooms and drops frames until the receiver acknowledges',async()=>{
 const server=createGameServer();server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;const sockets=[];
 const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json();};
 const connect=async(token)=>{const ws=new WebSocket(base.replace('http:','ws:')+'/api/live');sockets.push(ws);const binary=[],json=[];ws.on('message',(raw,isBinary)=>isBinary?binary.push(raw):json.push(JSON.parse(raw)));await once(ws,'open');ws.send(JSON.stringify({type:'auth',token}));await wait(()=>json.some(m=>m.type==='connected'));return {ws,binary,json};};
 const wait=async(check)=>{for(let i=0;i<150;i++){if(check())return;await delay(10);}throw Error('Live relay timed out');};
 // Minimal SOF fixture for bounded-frame transport validation; not a decode test.
 const jpeg=Buffer.from([255,216,255,192,0,8,8,0,1,0,1,1]);
 try{
  const a=await post('create',{}),b=await post('join',{code:a.code}),c=await post('create',{});
  const [p1,p2,outsider]=await Promise.all([a,b,c].map(p=>connect(p.token)));
  p1.ws.send(jpeg);p1.ws.send(jpeg);await wait(()=>p2.binary.length===1);await delay(80);
  assert.equal(p2.binary.length,1);assert.equal(outsider.binary.length,0);assert.equal(p1.binary.length,0);
  p2.ws.send(JSON.stringify({type:'video-ack'}));p2.ws.send(JSON.stringify({type:'telemetry',requestId:99,body:{hands:0,fps:0}}));await wait(()=>p2.json.some(m=>m.requestId===99));
  p1.ws.send(jpeg);await wait(()=>p2.binary.length===2);assert.deepEqual(p2.binary[1],jpeg);
  p2.ws.send(Buffer.from('invalid'));await once(p2.ws,'close');assert.equal(server.listening,true);
 }finally{for(const ws of sockets)ws.terminate();await new Promise(resolve=>server.close(resolve));}
});
