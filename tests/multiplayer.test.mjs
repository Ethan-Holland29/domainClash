import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,TURN_MS,LINE_MS} from '../server/match.mjs';
import {createGameServer,clientAddress} from '../server/index.mjs';
function active(random=()=>0.5){const m=new Match(0,random);m.join(0);m.select(0,'gojo');m.select(1,'sukuna');m.ready(0,0);m.ready(1,0);m.tick(3000);return m;}
function tick(m,t){m.players.forEach(p=>{if(p)p.lastSeen=t;});m.tick(t);}
test('server controls readiness and countdown; a turn resolves only when both players have chosen',()=>{
 const m=new Match(0,()=>0.5);assert.equal(m.choose(0,'BASIC_PUNCH',0),'Wait for the fight to start');m.join(0);m.select(0,'gojo');m.select(1,'sukuna');m.ready(0,0);assert.equal(m.phase,'waiting');m.ready(1,0);assert.equal(m.phase,'countdown');m.tick(2999);assert.equal(m.phase,'countdown');m.tick(3000);
 assert.equal(m.phase,'playing');assert.deepEqual(m.battle.sides.map(f=>f.id),['gojo','sukuna']);
 assert.equal(m.choose(0,'REVERSAL_RED',3000),null);assert.equal(m.battle.turn,1);assert.equal(m.choose(0,'BASIC_PUNCH',3001),'Move already chosen for this turn');
 assert.equal(m.snapshot(1).players[0].chosen,true);assert.equal(m.snapshot(1).players[0].choice,null);assert.equal(m.snapshot(0).players[0].choice,'REVERSAL_RED');
 assert.equal(m.choose(1,'BASIC_PUNCH',3100),null);assert.equal(m.battle.turn,2);
 const turn=m.events.find(e=>e.type==='turn');assert.ok(turn.lines.some(l=>l.text==='Satoru Gojo used Reversal: Red!'));assert.ok(turn.lines.every(l=>l.hp.length===2));
 assert.equal(m.snapshot(0).players.every(p=>!p.chosen),true);
});
test('illegal moves are refused without spending anything',()=>{
 const m=active();
 assert.equal(m.choose(0,'SUKUNA_ULTIMATE',3000),'Not in this kit');assert.equal(m.choose(0,'GOJO_ULTIMATE',3000),'Needs 100 meter');
 assert.equal(m.choose(0,'__proto__',3000),'Not in this kit');assert.equal(m.choose(0,42,3000),'Unknown move');
 assert.equal(m.battle.sides[0].ce,0);assert.equal(m.snapshot(0).players[0].chosen,false);
});
test('the turn timer picks a move for anyone who has not chosen, after the last turn has had time to play',()=>{
 const m=active();m.choose(0,'BASIC_PUNCH',3000);tick(m,3000+TURN_MS-1);assert.equal(m.battle.turn,1);
 tick(m,3000+TURN_MS);assert.equal(m.battle.turn,2);assert.ok(m.events.some(e=>e.type==='timeout'&&e.owner===1));
 const lines=m.events.find(e=>e.type==='turn').lines.length;assert.equal(m.deadline,3000+TURN_MS+lines*LINE_MS+TURN_MS);
});
test('a knockout finishes the match and rejects further moves',()=>{
 const m=active();m.battle.sides[1].hp=5;m.choose(0,'BASIC_PUNCH',3000);m.choose(1,'BASIC_PUNCH',3000);
 assert.equal(m.phase,'finished');assert.equal(m.winner,0);assert.equal(m.reason,'Knockout');assert.equal(m.choose(0,'BASIC_PUNCH',3100),'Wait for the fight to start');
});
test('disconnect, leave and stale inputs',()=>{
 const m=active();m.players[0].lastSeen=16001;m.tick(16001);assert.equal(m.winner,0);assert.equal(m.phase,'finished');
 const n=active();n.leave(0);assert.equal(n.winner,1);n.leave(1);assert.equal(n.winner,1);
 const r=active();tick(r,5000);assert.equal(r.choose(0,'BASIC_PUNCH',4000),'Stale input');assert.equal(r.snapshot(0).players[0].chosen,false);
});
test('real HTTP server isolates rooms, rejects strangers and full rooms, synchronizes two clients',async()=>{
 const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,body,token)=>{const r=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const a=(await call('create',{})).data,b=(await call('join',{code:a.code})).data,c=(await call('create',{})).data;
  assert.match(a.code,/^[A-F0-9]{10}$/);assert.notEqual(a.token,b.token);assert.equal((await call('join',{code:a.code})).status,409);assert.equal((await call('state')).status,401);
  await call('character',{id:'gojo'},a.token);await call('character',{id:'sukuna'},b.token);await call('ready',{},a.token);await call('ready',{},b.token);const sa=(await call('state',undefined,a.token)).data,sb=(await call('state',undefined,b.token)).data;assert.equal(sa.phase,'countdown');assert.equal(sb.phase,'countdown');assert.equal(sa.seat,0);assert.equal(sb.seat,1);assert.equal((await call('state',undefined,c.token)).data.phase,'waiting');
  await call('leave',{},a.token);assert.equal((await call('state',undefined,b.token)).data.winner,1);assert.equal((await call('move',{id:'BASIC_PUNCH'},b.token)).status,409);
  const blocked=await fetch(base+'/api/create',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,403);
 }finally{await new Promise(r=>server.close(r));}
});

test('both disconnected players end in a draw rather than an arbitrary winner',()=>{
 const m=active();m.tick(19000);assert.equal(m.phase,'finished');assert.equal(m.winner,null);assert.equal(m.reason,'Both players disconnected');
});

test('Cloudflare client IP is trusted only from an explicitly enabled local tunnel',()=>{
 const previous=process.env.TRUST_LOCAL_CLOUDFLARE;
 const request=(peer,ip)=>({socket:{remoteAddress:peer},headers:{'cf-connecting-ip':ip}});
 try{
  delete process.env.TRUST_LOCAL_CLOUDFLARE;
  assert.equal(clientAddress(request('127.0.0.1','203.0.113.1')),'127.0.0.1');
  process.env.TRUST_LOCAL_CLOUDFLARE='1';
  assert.equal(clientAddress(request('127.0.0.1','203.0.113.1')),'203.0.113.1');
  assert.equal(clientAddress(request('::1','2001:db8::1')),'2001:db8::1');
  assert.equal(clientAddress(request('192.0.2.1','203.0.113.1')),'192.0.2.1');
  assert.equal(clientAddress(request('127.0.0.1','invalid')),'127.0.0.1');
 }finally{if(previous===undefined)delete process.env.TRUST_LOCAL_CLOUDFLARE;else process.env.TRUST_LOCAL_CLOUDFLARE=previous;}
});


test('camera relay authenticates, isolates rooms, bounds uploads and clears stopped video',async()=>{
 const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const api=async(route,body)=>await (await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
 const video=(token,method='GET',body)=>fetch(base+'/api/video',{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'image/jpeg'}:{})},body});
 // Minimal bounded SOF segment for transport validation, not a decoded visual fixture.
 const jpeg=Buffer.from([255,216,255,192,0,8,8,0,2,0,2,1,255,217]);
 try{
  const a=await api('create',{}),b=await api('join',{code:a.code}),other=await api('create',{});
  assert.equal((await video(null)).status,401);
  assert.equal((await video(a.token,'POST',jpeg)).status,200);
  const received=await video(b.token);assert.equal(received.status,200);assert.equal(received.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await received.arrayBuffer()),jpeg);
  assert.equal((await video(other.token)).status,204);assert.equal((await video(a.token)).status,204);
  assert.equal((await video(a.token,'POST',Buffer.from('invalid'))).status,400);
  assert.equal((await video(a.token,'POST',Buffer.alloc(100001))).status,413);
  const huge=Buffer.from(jpeg);huge.writeUInt16BE(10000,9);assert.equal((await video(a.token,'POST',huge)).status,400);
  assert.equal((await video(a.token,'DELETE')).status,200);assert.equal((await video(b.token)).status,204);
  await video(a.token,'POST',jpeg);
  await fetch(base+'/api/leave',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:'{}'});
  assert.equal((await video(a.token)).status,401);assert.equal((await video(b.token)).status,204);
 }finally{await new Promise(r=>server.close(r));}
});


test('live sockets authenticate, keep choices secret, push each turn once and isolate video signaling',async()=>{
 const {WebSocket}=await import('ws');const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const sockets=[];
 const api=async(route,body)=>await (await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
 const connect=async(token)=>{const ws=new WebSocket(base.replace('http','ws')+'/api/live');sockets.push(ws);const messages=[];ws.on('message',data=>messages.push(JSON.parse(data)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'auth',token}));return {ws,messages};};
 const wait=async(predicate)=>{const until=Date.now()+5000;while(!predicate()){if(Date.now()>until)throw Error('Socket assertion timed out');await new Promise(r=>setTimeout(r,20));}};
 try{
  const a=await api('create',{}),b=await api('join',{code:a.code}),c=await api('create',{});
  const first=await connect(a.token),second=await connect(b.token),other=await connect(c.token);
  await wait(()=>first.messages.some(m=>m.type==='state'));
  first.ws.send(JSON.stringify({type:'signal',requestId:1,body:{type:'offer',sdp:'v=0\r\n'}}));
  await wait(()=>second.messages.some(m=>m.state?.peerSignal?.type==='offer'));
  assert.equal(first.messages.some(m=>m.state?.peerSignal),false);assert.equal(other.messages.some(m=>m.state?.peerSignal),false);
  first.ws.send(JSON.stringify({type:'character',requestId:10,body:{id:'sukuna'}}));second.ws.send(JSON.stringify({type:'character',requestId:10,body:{id:'gojo'}}));
  first.ws.send(JSON.stringify({type:'ready',requestId:2}));second.ws.send(JSON.stringify({type:'ready',requestId:2}));
  await wait(()=>first.messages.some(m=>m.state?.phase==='playing'));
  first.ws.send(JSON.stringify({type:'move',requestId:3,body:{id:'CLEAVE'}}));
  await wait(()=>first.messages.some(m=>m.requestId===3));
  first.ws.send(JSON.stringify({type:'move',requestId:4,body:{id:'BASIC_PUNCH'}}));
  await wait(()=>second.messages.some(m=>m.state?.players[0]?.chosen));
  assert.equal(second.messages.some(m=>m.state?.players[0]?.choice),false);
  second.ws.send(JSON.stringify({type:'move',requestId:5,body:{id:'AMPLIFICATION_BLUE'}}));
  await wait(()=>second.messages.some(m=>m.state?.battle?.turn===2));
  assert.ok(first.messages.find(m=>m.requestId===4).error);
  assert.equal(second.messages.flatMap(m=>m.state?.events||[]).filter(e=>e.type==='turn').length,1);
  assert.equal(other.messages.some(m=>m.state?.events?.some(e=>e.type==='turn')),false);
  const denied=await connect('not-a-session');await new Promise(r=>denied.ws.once('close',r));assert.equal(denied.messages.some(m=>m.type==='state'),false);
 }finally{for(const ws of sockets)ws.terminate();await new Promise(r=>server.close(r));}
});
