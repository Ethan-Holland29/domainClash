import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,rules} from '../server/match.mjs';
import {createGameServer,clientAddress} from '../server/index.mjs';
function active(){const m=new Match(0);m.join(0);m.ready(0,0);m.ready(1,0);m.tick(3000);return m;}
function tick(m,t){m.players.forEach(p=>{if(p)p.lastSeen=t;});m.tick(t);}
test('server controls readiness, countdown, health and global regular cooldown',()=>{
 const m=new Match(0);assert.equal(m.cast(0,'PRIMARY_ATTACK',0),'Wait for the fight to start');m.join(0);m.ready(0,0);assert.equal(m.phase,'waiting');m.ready(1,0);assert.equal(m.phase,'countdown');m.tick(2999);assert.equal(m.phase,'countdown');m.tick(3000);
 assert.equal(m.cast(0,'PRIMARY_ATTACK',3000),null);assert.match(m.cast(0,'HOLLOW_PURPLE',3999),/one second/);assert.equal(m.cast(0,'HOLLOW_PURPLE',4000),null);tick(m,4180);assert.equal(m.players[1].hp,74);
});
test('equal-tier domains at exactly one second coexist and announce once',()=>{
 const m=active();m.cast(0,'UNLIMITED_VOID',3000);assert.equal(m.cast(1,'MALEVOLENT_SHRINE',4000),null);assert.equal(m.domains.length,2);assert.equal(m.events.filter(e=>e.type==='clash').length,1);tick(m,9000);assert.equal(m.players[0].hp,100);assert.equal(m.players[1].hp,100);
 assert.ok(m.cast(0,'IRON_MOUNTAIN',9000));assert.equal(m.events.filter(e=>e.type==='clash').length,1);
});
test('equal late domain rejected; stronger replaces weaker; lower tier cannot overwrite',()=>{
 const m=active();m.cast(0,'IRON_MOUNTAIN',3000);assert.match(m.cast(1,'SELF_EMBODIMENT',4001),/window/);assert.equal(m.cast(1,'UNLIMITED_VOID',4001),null);assert.equal(m.domains.length,1);assert.equal(m.domains[0].owner,1);assert.ok(m.events.some(e=>e.type==='overtake'));
 const n=active();n.cast(0,'UNLIMITED_VOID',3000);assert.match(n.cast(1,'IRON_MOUNTAIN',3100),/higher refinement/);assert.equal(n.players[1].energy,100);
});
test('changing domain IDs cannot bypass shared domain recovery',()=>{
 const m=active();m.cast(0,'IRON_MOUNTAIN',3000);tick(m,12900);assert.equal(m.domains.length,0);assert.match(m.cast(0,'UNLIMITED_VOID',13000),/cooling/);tick(m,17000);assert.equal(m.cast(0,'UNLIMITED_VOID',17000),null);
});
test('energy prevents strongest-attack spam and guard reduces only regular damage',()=>{
 const m=active();for(let i=0;i<3;i++)assert.equal(m.cast(0,'HOLLOW_PURPLE',3000+i*1000),null);assert.match(m.cast(0,'HOLLOW_PURPLE',6000),/energy/);
 const n=active();n.guard(1,3000);n.cast(0,'PRIMARY_ATTACK',3000);tick(n,3180);assert.equal(n.players[1].hp,96);assert.ok(n.guard(1,3300));
});
test('simultaneous lethal attacks draw, freeze results and clear pending damage',()=>{
 const m=active();m.players.forEach(p=>p.hp=8);m.cast(0,'PRIMARY_ATTACK',3000);m.cast(1,'PRIMARY_ATTACK',3000);tick(m,3180);assert.equal(m.phase,'finished');assert.equal(m.winner,null);assert.equal(m.pending.length,0);assert.ok(m.cast(0,'UNLIMITED_VOID',4000));
});
test('disconnect, leave and time limit end a match without late damage',()=>{
 const m=active();m.players[0].lastSeen=16001;m.tick(16001);assert.equal(m.winner,0);assert.equal(m.phase,'finished');
 const n=active();n.leave(0);assert.equal(n.winner,1);n.leave(1);assert.equal(n.winner,1);
 const r=active();r.players[0].hp=70;r.players[1].hp=60;tick(r,183000);assert.equal(r.winner,0);
});
test('all domain cooldowns match the catalog and malformed casts do not mutate state',async()=>{
 const {Moves}=await import('../.test-build/combat/MoveCatalog.js');assert.equal(Moves.length,Object.keys(rules).length);
 for(const move of Moves){assert.equal(rules[move.id].cooldown,move.cooldownMs);assert.equal(rules[move.id].duration,move.durationMs);}
 const m=active();assert.equal(m.cast(0,'__proto__',3000),'Unknown technique');assert.equal(m.players[0].energy,100);
});
test('real HTTP server isolates rooms, rejects strangers and full rooms, synchronizes two clients',async()=>{
 const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,body,token)=>{const r=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const a=(await call('create',{})).data,b=(await call('join',{code:a.code})).data,c=(await call('create',{})).data;
  assert.match(a.code,/^[A-F0-9]{10}$/);assert.notEqual(a.token,b.token);assert.equal((await call('join',{code:a.code})).status,409);assert.equal((await call('state')).status,401);
  await call('character',{id:'gojo'},a.token);await call('character',{id:'sukuna'},b.token);await call('ready',{},a.token);await call('ready',{},b.token);const sa=(await call('state',undefined,a.token)).data,sb=(await call('state',undefined,b.token)).data;assert.equal(sa.phase,'countdown');assert.equal(sb.phase,'countdown');assert.equal(sa.seat,0);assert.equal(sb.seat,1);assert.equal((await call('state',undefined,c.token)).data.phase,'waiting');
  await call('leave',{},a.token);assert.equal((await call('state',undefined,b.token)).data.winner,1);assert.equal((await call('cast',{id:'PRIMARY_ATTACK'},b.token)).status,409);
  const blocked=await fetch(base+'/api/create',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,403);
 }finally{await new Promise(r=>server.close(r));}
});

test('stale client timestamps cannot backdate attacks',()=>{
 const m=active();tick(m,5000);assert.equal(m.cast(0,'PRIMARY_ATTACK',4000),'Stale input');assert.equal(m.pending.length,0);
});
test('domain damage resumes when one clashing domain expires; end timestamp is respected',()=>{
 const m=active();m.cast(0,'UNLIMITED_VOID',3000);m.cast(1,'MALEVOLENT_SHRINE',4000);tick(m,12399);assert.equal(m.players[0].hp,100);tick(m,14400);assert.equal(m.players[0].hp,94);assert.equal(m.players[1].hp,100);assert.equal(m.domains.length,0);
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


test('live sockets authenticate, push casts once, enforce cooldowns and isolate video signaling',async()=>{
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
  first.ws.send(JSON.stringify({type:'cast',requestId:3,body:{id:'PRIMARY_ATTACK'}}));
  first.ws.send(JSON.stringify({type:'cast',requestId:4,body:{id:'PRIMARY_ATTACK'}}));
  await wait(()=>second.messages.some(m=>m.state?.players[1]?.hp===92));
  assert.equal(second.messages.flatMap(m=>m.state?.events||[]).filter(e=>e.type==='cast').length,1);
  assert.ok(first.messages.find(m=>m.requestId===4).error);
  assert.equal(other.messages.some(m=>m.state?.events?.some(e=>e.type==='cast')),false);
  const denied=await connect('not-a-session');await new Promise(r=>denied.ws.once('close',r));assert.equal(denied.messages.some(m=>m.type==='state'),false);
 }finally{for(const ws of sockets)ws.terminate();await new Promise(r=>server.close(r));}
});
