import {DurableObject} from 'cloudflare:workers';
import {Buffer} from 'node:buffer';
import {Match} from '../server/match.mjs';
import {signal,snapshot} from '../server/protocol.mjs';
import {validFrame} from '../server/video.mjs';

const json=(status,value)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const empty=()=>new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
const randomHex=length=>Array.from(crypto.getRandomValues(new Uint8Array(length)),b=>b.toString(16).padStart(2,'0')).join('');
async function readBody(request,max){
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();
 const chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new Error('Request too large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/health')return json(200,{ok:true,hosting:'cloudflare'});
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  const origin=request.headers.get('origin');
  if(origin&&origin!==url.origin)return json(403,{error:'Origin not allowed'});
  // One bounded arena shares the free-plan duration allocation across matches.
  return env.ARENA.get(env.ARENA.idFromName('integration-arena-v1')).fetch(request);
 }
};

export class Arena extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);this.rooms=new Map();this.sessions=new Map();this.limits=new Map();this.clients=new Map();this.timer=null;
 }
 limit(key,max,now=Date.now()){
  let value=this.limits.get(key);if(!value||now-value.at>=10000){value={at:now,count:0};this.limits.set(key,value);}return ++value.count<=max;
 }
 start(){if(!this.timer)this.timer=setInterval(()=>this.tick(),50);}
 tick(){
  const now=Date.now();
  for(const [code,room] of this.rooms){
   room.match.tick(now);
   if(room.frames)room.frames=room.frames.map(f=>f&&(room.match.phase==='finished'||now-f.at>2000)?null:f);
   if(room.match.phase==='waiting'&&now-room.match.waitingSince>600000||room.match.phase==='finished'&&now-room.match.finishedAt>120000){this.rooms.delete(code);for(const token of room.tokens)this.sessions.delete(token);}
  }
  for(const [ws,client] of this.clients){
   if(!client.session){if(now-client.opened>5000)this.close(ws,1008,'Authentication required');continue;}
   const {code,seat}=client.session,room=this.rooms.get(code);
   if(!room||!this.sessions.has(client.token)||!room.match.players[seat]){this.close(ws,1008,'Room expired');continue;}
   if(now-client.lastAck>15000){this.close(ws,1008,'Connection timed out');continue;}
   // Require receipt acknowledgments so slow clients cannot build a state queue.
   if(now-client.lastAck<2000){
    const state={...snapshot(room,seat),code};state.events=state.events.filter(e=>e.seq>client.lastSeq);client.lastSeq=room.match.seq;
    if(state.peerSignal?.seq===client.signalSeq)state.peerSignal=null;else if(state.peerSignal)client.signalSeq=state.peerSignal.seq;
    this.send(ws,{type:'state',state});
   }
   if(now-client.lastPing>=1000){client.lastPing=now;this.send(ws,{type:'ping'});}
  }
  for(const [key,value] of this.limits)if(now-value.at>60000)this.limits.delete(key);
  if(!this.rooms.size&&!this.clients.size){clearInterval(this.timer);this.timer=null;}
 }
 send(ws,value){try{ws.send(JSON.stringify(value));}catch{this.close(ws,1011,'Connection ended');}}
 close(ws,code,reason){this.clients.delete(ws);try{ws.close(code,reason);}catch{}}
 upgrade(){
  if(this.clients.size>=160)return json(503,{error:'Arena is full. Try again shortly.'});
  const pair=new WebSocketPair(),[client,server]=Object.values(pair);server.accept();
  this.clients.set(server,{opened:Date.now(),lastAck:Date.now(),lastPing:0,lastSeq:0,signalSeq:0,session:null,token:'',count:0,windowAt:Date.now()});
  server.addEventListener('message',event=>this.message(server,event.data));
  server.addEventListener('close',()=>this.clients.delete(server));
  server.addEventListener('error',()=>this.close(server,1011,'Connection ended'));
  this.start();return new Response(null,{status:101,webSocket:client});
 }
 message(ws,raw){
  const client=this.clients.get(ws);if(!client)return;const now=Date.now();
  if(now-client.windowAt>=1000){client.windowAt=now;client.count=0;}
  if(++client.count>40||typeof raw!=='string'||raw.length>35000){this.close(ws,1008,'Invalid or excessive input');return;}
  let message;try{message=JSON.parse(raw);}catch{this.close(ws,1008,'Invalid JSON');return;}
  if(!message||typeof message!=='object'||Array.isArray(message)){this.close(ws,1008,'Invalid message');return;}
  if(!client.session){
   const token=typeof message.token==='string'?message.token:'',session=this.sessions.get(token);
   if(message.type!=='auth'||!session){this.close(ws,1008,'Invalid session');return;}
   for(const [other,value] of this.clients)if(other!==ws&&value.token===token)this.close(other,1000,'Session replaced');
   client.session=session;client.token=token;this.send(ws,{type:'connected'});return;
  }
  const room=this.rooms.get(client.session.code);
  if(!room||!this.sessions.has(client.token)){this.close(ws,1008,'Room expired');return;}
  room.match.tick(now);if(!room.match.players[client.session.seat]){this.close(ws,1008,'Session expired');return;}room.match.players[client.session.seat].lastSeen=now;
  if(message.type==='pong'){client.lastAck=now;return;}
  const error=this.action(room,client.session.seat,message.type,message.body||{},now);
  this.send(ws,{type:'ack',requestId:message.requestId,error:error||null});
 }
 action(room,seat,type,body,now){
  if(type==='ready')return room.match.ready(seat,now,body);
  if(type==='cast')return room.match.cast(seat,typeof body.id==='string'?body.id:'',now,body);
  if(type==='select')return room.match.select(seat,body);
  if(type==='telemetry')return room.match.telemetry(seat,body);
  if(type==='guard')return room.match.guard(seat,now);
  if(type==='signal')return signal(room,seat,body);
  if(type==='camera'){room.cameraActive??=[false,false];room.cameraActive[seat]=body.active===true;return null;}
  return 'Unknown action';
 }
 async fetch(request){
  try{
   const route=new URL(request.url).pathname.slice(5),now=Date.now();
   const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
   const ip=request.headers.get('cf-connecting-ip')||'local';
   const category=['create','join','live'].includes(route)?'room':route==='video'?'video':'game';
   if(!this.limit((category==='video'&&this.sessions.has(token)?token:ip)+':'+category,category==='room'?20:200,now))return json(429,{error:'Too many requests; wait a moment'});
   if(route==='live'){if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return json(426,{error:'WebSocket required'});return this.upgrade();}
   if(route==='video')return await this.video(request,token);
   let body={};if(request.method==='POST'){
    const raw=await readBody(request,route==='signal'?32000:2048);
    try{body=JSON.parse(new TextDecoder().decode(raw)||'{}');}catch{return json(400,{error:'Invalid JSON'});}
    if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'Invalid request'});
   }
   // Reads above yield; use a fresh timestamp before mutating the authoritative match.
   const t=Date.now();
   if(request.method==='POST'&&['create','join'].includes(route)){
    let code,room,seat;
    if(route==='create'){
     if(this.rooms.size>=64)return json(503,{error:'Arena is full. Try again shortly.'});
     do{code=randomHex(5).toUpperCase();}while(this.rooms.has(code));
     room={match:new Match(t),created:t,tokens:[]};this.rooms.set(code,room);seat=0;
    }else{
     code=String(body.code??'').trim().toUpperCase();room=this.rooms.get(code);
     if(!room)return json(404,{error:'Room not found or expired'});
     room.match.tick(t);const error=room.match.join(t);if(error)return json(409,{error});seat=1;
    }
    const sessionToken=randomHex(32);room.tokens.push(sessionToken);this.sessions.set(sessionToken,{code,seat});this.start();return json(200,{token:sessionToken,code,seat});
   }
   const session=this.sessions.get(token),room=session&&this.rooms.get(session.code);
   if(!session||!room)return json(401,{error:'Room expired. Create or join again.'});
   room.match.tick(t);if(!room.match.players[session.seat]){this.sessions.delete(token);return json(401,{error:'Session expired. Create or join again.'});}room.match.players[session.seat].lastSeen=t;
   if(route==='state'&&request.method==='GET')return json(200,{...snapshot(room,session.seat),code:session.code});
   if(request.method!=='POST')return json(405,{error:'Method not allowed'});
   if(route==='leave'){room.match.leave(session.seat);room.frames=[null,null];this.sessions.delete(token);return json(200,{ok:true});}
   const error=this.action(room,session.seat,route,body,t);return json(error?409:200,error?{error}:{ok:true});
  }catch(error){return json(error.message==='Request too large'?413:400,{error:error.message==='Request too large'?'Request too large':'Invalid request'});}
 }
 async video(request,token){
  const session=this.sessions.get(token),room=session&&this.rooms.get(session.code);
  if(!session||!room)return json(401,{error:'Room expired'});
  room.match.tick(Date.now());if(room.match.phase==='finished'){room.frames=[null,null];return empty();}
  room.frames??=[null,null];
  if(request.method==='DELETE'){room.frames[session.seat]=null;return json(200,{ok:true});}
  if(request.method==='GET'){
   const frame=room.frames[1-session.seat];if(!frame||Date.now()-frame.at>2000)return empty();
   return new Response(frame.data,{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Frame-Id':String(frame.at)}});
  }
  if(request.method!=='POST')return json(405,{error:'Method not allowed'});
  if(request.headers.get('content-type')!=='image/jpeg')return json(415,{error:'JPEG required'});
  const data=Buffer.from(await readBody(request,100000));if(!validFrame(data))return json(400,{error:'Invalid camera frame'});
  if(!this.sessions.has(token)||room.match.phase==='finished')return empty();
  room.frames[session.seat]={data,at:Date.now()};return json(200,{ok:true});
 }
}
