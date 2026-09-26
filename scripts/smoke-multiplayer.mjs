import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {setTimeout as delay} from 'node:timers/promises';
const base=process.argv[2];if(!base)throw Error('Pass the local or deployed site URL.');
const players=[],sockets=[];
async function api(route,body,token){const response=await fetch(base+'/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)});return {status:response.status,data:await response.json()};}
async function live(token){
 const ws=new WebSocket(base.replace(/^http/,'ws')+'/api/live');sockets.push(ws);const inbox=[];
 ws.on('message',raw=>{const message=JSON.parse(raw.toString());if(message.type==='ping')ws.send(JSON.stringify({type:'pong'}));else inbox.push(message);});
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'auth',token}));
 return {ws,inbox};
}
async function until(check){const end=Date.now()+8000;while(Date.now()<end){if(check())return;await delay(50);}throw Error('Timed out waiting for live state.');}
try{
 const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/DomainClash/);
 assert.equal((await api('state')).status,401);
 const a=await api('create',{});assert.equal(a.status,200);players.push(a.data);
 const b=await api('join',{code:a.data.code});assert.equal(b.status,200);players.push(b.data);
 assert.equal((await api('join',{code:a.data.code})).status,409);
 const [p1,p2]=await Promise.all(players.map(p=>live(p.token)));
 await until(()=>[p1,p2].every(p=>p.inbox.some(m=>m.type==='state')));
 for(const [i,id] of ['ryu','choso'].entries())assert.equal((await api('select',{id,round:1},players[i].token)).status,200);
 for(const p of players)assert.equal((await api('ready',{round:1},p.token)).status,200);
 await until(()=>[p1,p2].every(p=>p.inbox.some(m=>m.type==='state'&&m.state.phase==='playing')));
 assert.equal((await api('select',{id:'gojo',round:1},players[0].token)).status,409);
 assert.equal((await api('cast',{id:'CLEAVE',round:1},players[0].token)).status,409);
 assert.equal((await api('cast',{id:'BASIC_PUNCH',round:1},players[1].token)).status,409);
 assert.equal((await api('cast',{id:'GRANITE_BLAST',round:1},players[0].token)).status,200);
 await until(()=>p2.inbox.some(m=>m.type==='state'&&m.state.game?.turn==='enemy'));
 assert.equal((await api('cast',{id:'PIERCING_BLOOD',round:1},players[1].token)).status,200);
 await until(()=>p1.inbox.some(m=>m.type==='state'&&m.state.game?.turnNumber>=2));
 const state=await api('state',undefined,players[1].token);assert.equal(state.data.seat,1);assert.equal(state.data.game.player.character.id,'ryu');assert.equal(state.data.game.opponent.character.id,'choso');
 console.log('PASS: public page, private rooms, authenticated live state, both confirmations, fighter lock, turn ownership and bidirectional attacks.');
}finally{for(const p of players)await api('leave',{},p.token).catch(()=>{});for(const ws of sockets)ws.terminate();}
