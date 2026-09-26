import assert from 'node:assert/strict';
import {WebSocket} from 'ws';

const base=process.argv[2]||'http://127.0.0.1:8787';
const sockets=[],tokens=[];
const api=async(route,body,token)=>{
 const response=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
};
const wait=async(predicate)=>{const until=Date.now()+10000;while(!predicate()){if(Date.now()>until)throw Error('Live assertion timed out');await new Promise(r=>setTimeout(r,25));}};
const connect=async(token)=>{
 const ws=new WebSocket(base.replace(/^http/,'ws')+'/api/live',{origin:base});sockets.push(ws);const messages=[];
 ws.on('message',raw=>{const message=JSON.parse(raw);messages.push(message);if(message.type==='ping')ws.send(JSON.stringify({type:'pong'}));});
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'auth',token}));return {ws,messages};
};
try{
 assert.equal((await fetch(base+'/health')).status,200);
 assert.equal((await fetch(base+'/')).status,200);
 const a=(await api('create',{})).data;assert.ok(a.token);tokens.push(a.token);
 const b=(await api('join',{code:a.code})).data;assert.ok(b.token);tokens.push(b.token);
 const c=(await api('create',{})).data;assert.ok(c.token);tokens.push(c.token);
 assert.equal((await api('state')).status,401);
 assert.equal((await api('join',{code:a.code})).status,409);
 assert.equal((await fetch(base+'/api/create',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/cast',{method:'POST',headers:{Authorization:'Bearer '+a.token},body:'x'.repeat(2049)})).status,413);
 const first=await connect(a.token),second=await connect(b.token),other=await connect(c.token);
 await wait(()=>first.messages.some(m=>m.type==='state'));
 first.ws.send(JSON.stringify({type:'signal',requestId:1,body:{type:'offer',sdp:'v=0\r\n'}}));
 await wait(()=>second.messages.some(m=>m.state?.peerSignal?.type==='offer'));
 assert.equal(other.messages.some(m=>m.state?.peerSignal),false);
 first.ws.send(JSON.stringify({type:'ready',requestId:2}));second.ws.send(JSON.stringify({type:'ready',requestId:2}));
 await wait(()=>first.messages.some(m=>m.state?.phase==='playing'));
 first.ws.send(JSON.stringify({type:'cast',requestId:3,body:{id:'PRIMARY_ATTACK'}}));
 first.ws.send(JSON.stringify({type:'cast',requestId:4,body:{id:'PRIMARY_ATTACK'}}));
 await wait(()=>second.messages.some(m=>m.state?.players[1]?.hp===92));
 assert.ok(first.messages.find(m=>m.requestId===4)?.error);
 assert.equal(second.messages.flatMap(m=>m.state?.events||[]).filter(e=>e.type==='cast').length,1);
 assert.equal(other.messages.some(m=>m.state?.events?.some(e=>e.type==='cast')),false);
 const video=(token,method='GET',body)=>fetch(base+'/api/video',{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'image/jpeg'}:{})},body});
 const jpeg=Buffer.from([255,216,255,192,0,8,8,0,2,0,2,1,255,217]);
 assert.equal((await video(a.token,'POST',jpeg)).status,200);
 assert.deepEqual(Buffer.from(await (await video(b.token)).arrayBuffer()),jpeg);
 assert.equal((await video(c.token)).status,204);
 assert.equal((await video(a.token,'POST',Buffer.alloc(100001))).status,413);
 assert.equal((await video(a.token,'DELETE')).status,200);
 assert.equal((await video(b.token)).status,204);
 const denied=await connect('invalid');await new Promise(r=>denied.ws.once('close',r));
 assert.equal(denied.messages.some(m=>m.type==='state'),false);
 // Keep connected for longer than the match's 15-second stale-player deadline.
 await new Promise(r=>setTimeout(r,16000));
 assert.equal((await api('state',undefined,a.token)).data.phase,'playing');
 await api('leave',{},a.token);
 assert.equal((await api('state',undefined,b.token)).data.winner,1);
 console.log('PASS: assets, room isolation, origin/session checks, bounded uploads, live combat, cooldowns, private video signaling, heartbeat and leave.');
}finally{
 for(const ws of sockets)ws.terminate();
 for(const token of tokens)await api('leave',{},token).catch(()=>{});
}
