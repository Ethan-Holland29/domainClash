import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Match} from './match.mjs';
import {isIP} from 'node:net';
import {validFrame} from './video.mjs';
import {attachRealtime,signal,snapshot} from './realtime.mjs';
export function clientAddress(req){
 const peer=req.socket.remoteAddress||'unknown';
 const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer);
 const forwarded=req.headers['cf-connecting-ip'];
 return process.env.TRUST_LOCAL_CLOUDFLARE==='1'&&local&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:peer;
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
export function createGameServer(){
 const rooms=new Map(),sessions=new Map(),limits=new Map();
 const now=()=>performance.now();
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const timer=setInterval(()=>{const t=now();for(const [code,room] of rooms){const round=room.roundSeen??1;room.match.tick(t);room.roundSeen=room.match.round;if(round!==room.match.round){room.created=t;room.signals=[null,null];room.cameraActive=[false,false];room.frames=[null,null];for(const token of room.tokens){const session=sessions.get(token);if(session&&!room.match.players[session.seat])sessions.delete(token);}}if(!room.match.players.some(Boolean)){rooms.delete(code);for(const token of room.tokens)sessions.delete(token);continue;}if(room.frames)room.frames=room.frames.map(f=>f&&(room.match.phase==='finished'||t-f.at>2000)?null:f);if(room.match.phase==='waiting'&&t-room.created>600000||room.match.phase==='finished'&&t-room.match.finishedAt>120000){rooms.delete(code);for(const token of room.tokens)sessions.delete(token);}}for(const [key,v]of limits)if(t-v.at>60000)limits.delete(key);},50);timer.unref();
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  try{
   const url=new URL(req.url,'http://local');
   if(url.pathname==='/health'){json(res,200,{ok:true});return;}
   if(url.pathname.startsWith('/api/')){
    const origin=req.headers.origin;
    const permitted=(process.env.ALLOWED_ORIGINS||'http://127.0.0.1:5173,http://localhost:5173').split(',');
    if(origin&&!permitted.includes(origin)&&new URL(origin).host!==req.headers.host){json(res,403,{error:'Origin not allowed'});return;}
    const videoToken=(req.headers.authorization||'').replace(/^Bearer /,'');
    const ip=clientAddress(req),key=(sessions.has(videoToken)?videoToken:ip)+':'+(url.pathname==='/api/create'||url.pathname==='/api/join'?'room':url.pathname==='/api/video'?'video':'game');let t=now();
    let limit=limits.get(key);if(!limit||t-limit.at>10000){limit={at:t,count:0};limits.set(key,limit);}if(++limit.count>(key.endsWith(':room')?20:key.endsWith(':video')?300:200)){json(res,429,{error:'Too many requests; wait a moment'});return;}
    if(url.pathname==='/api/video'){
     const token=(req.headers.authorization||'').replace(/^Bearer /,'');const session=sessions.get(token),room=session&&rooms.get(session.code);
     if(!session||!room||!room.match.players[session.seat]||room.tokens[session.seat]!==token){json(res,401,{error:'Room expired'});return;}
     room.match.tick(now());
     if(room.match.phase==='finished'){room.frames=[null,null];res.writeHead(204,{'Cache-Control':'no-store'});res.end();return;}
     room.frames??=[null,null];
     if(req.method==='DELETE'){room.frames[session.seat]=null;json(res,200,{ok:true});return;}
     if(req.method==='GET'){
      const frame=room.frames[1-session.seat];
      if(!frame||now()-frame.at>2000){res.writeHead(204,{'Cache-Control':'no-store'});res.end();return;}
      res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Frame-Id':String(frame.at)});res.end(frame.data);return;
     }
     if(req.method!=='POST'){json(res,405,{error:'Method not allowed'});return;}
     if(req.headers['content-type']!=='image/jpeg'){json(res,415,{error:'JPEG required'});return;}
     const chunks=[];let size=0;
     for await(const chunk of req){size+=chunk.length;if(size>100000){json(res,413,{error:'Frame too large'});return;}chunks.push(chunk);}
     const data=Buffer.concat(chunks);
     if(!validFrame(data)){json(res,400,{error:'Invalid camera frame'});return;}
     if(!sessions.has(token)||room.match.phase==='finished'){res.writeHead(204);res.end();return;}
     room.frames[session.seat]={data,at:now()};json(res,200,{ok:true});return;
    }
    let body={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>(url.pathname==='/api/signal'?32000:2048)){json(res,413,{error:'Request too large'});return;}}try{body=JSON.parse(raw||'{}');}catch{json(res,400,{error:'Invalid JSON'});return;}if(!body||typeof body!=='object'||Array.isArray(body)){json(res,400,{error:'Invalid request'});return;}}
    t=now();
    if(req.method==='POST'&&(url.pathname==='/api/create'||url.pathname==='/api/join')){
     let code,room,seat;
     if(url.pathname==='/api/create'){
      if(rooms.size>=500){json(res,503,{error:'Server is full'});return;}
      do{code=randomBytes(5).toString('hex').toUpperCase();}while(rooms.has(code));
      room={match:new Match(t),created:t,tokens:[]};room.match.requireCharacter=true;rooms.set(code,room);seat=0;
     }else{code=String(body.code??'').trim().toUpperCase();room=rooms.get(code);if(!room){json(res,404,{error:'Room not found or expired'});return;}room.match.tick(t);const error=room.match.join(t);if(error){json(res,409,{error});return;}seat=room.match.lastJoinedSeat;}
     const token=randomBytes(32).toString('hex');room.tokens[seat]=token;sessions.set(token,{code,seat});json(res,200,{token,code,seat});return;
    }
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');const session=sessions.get(token),room=session&&rooms.get(session.code);
    if(!session||!room){json(res,401,{error:'Room expired. Create or join again.'});return;}
    const match=room.match;match.tick(t);if(!match.players[session.seat]){sessions.delete(token);json(res,401,{error:'Room expired'});return;}match.players[session.seat].lastSeen=t;
    if(req.method==='GET'&&url.pathname==='/api/state'){json(res,200,{...snapshot(room,session.seat),code:session.code});return;}
    if(req.method!=='POST'){json(res,405,{error:'Method not allowed'});return;}
    let error;
    if(url.pathname==='/api/character')error=match.select(session.seat,body.id);
    else if(url.pathname==='/api/preview')error=match.preview(session.seat,body.id);
    else if(url.pathname==='/api/tracking')error=match.tracking(session.seat,body);
    else if(url.pathname==='/api/ready')error=match.ready(session.seat,t);
    else if(url.pathname==='/api/move')error=match.choose(session.seat,typeof body.id==='string'?body.id:'',t);
    else if(url.pathname==='/api/signal')error=signal(room,session.seat,body);
    else if(url.pathname==='/api/camera'){room.cameraActive??=[false,false];room.cameraActive[session.seat]=body.active===true;}
    else if(url.pathname==='/api/leave'){match.leave(session.seat);room.frames=[null,null];sessions.delete(token);}
    else{json(res,404,{error:'Not found'});return;}
    json(res,error?409:200,error?{error}:{ok:true});return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
   const requested=decodeURIComponent(url.pathname),file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
   if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   const data=await readFile(file);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.json':'application/json','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime,'Cache-Control':file.includes(path.sep+'assets'+path.sep)?'public,max-age=31536000,immutable':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){json(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'Not found. Build the app before starting the server.':'Invalid request'});}
 });
 server.on('close',()=>clearInterval(timer));server.requestTimeout=10000;server.headersTimeout=10000;
 server.realtime=attachRealtime(server,rooms,sessions);
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=createGameServer();server.listen(Number(process.env.PORT)||3001,process.env.HOST||'0.0.0.0',()=>console.log('DomainClash server listening on port '+(Number(process.env.PORT)||3001)));
 process.on('SIGTERM',()=>{for(const ws of server.realtime.clients)ws.terminate();server.close(()=>process.exit(0));});
}
