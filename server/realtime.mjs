import {WebSocketServer,WebSocket} from 'ws';
import {signal,snapshot} from './protocol.mjs';
export {signal,snapshot} from './protocol.mjs';
export function attachRealtime(server,rooms,sessions){
 const wss=new WebSocketServer({noServer:true,maxPayload:35000,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  let valid=false;try{valid=new URL(req.url,'http://local').pathname==='/api/live'&&(!req.headers.origin||new URL(req.headers.origin).host===req.headers.host||['http://localhost:5173','http://127.0.0.1:5173'].includes(req.headers.origin));}catch{}
  if(!valid){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
 });
 wss.on('connection',ws=>{
  let session=null,token='',lastSeq=0,signalSeq=0,count=0,windowAt=performance.now(),lastPing=0;
  const authTimer=setTimeout(()=>ws.close(1008,'Authentication required'),5000);
  const send=value=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(value));};
  ws.on('error',()=>{});
  ws.on('pong',()=>{const room=session&&rooms.get(session.code);if(room?.match.players[session.seat])room.match.players[session.seat].lastSeen=performance.now();});
  const timer=setInterval(()=>{
   const room=session&&rooms.get(session.code);if(!session)return;
   if(!room||!sessions.has(token)||room.tokens[session.seat]!==token||!room.match.players[session.seat]){ws.close(1008,'Room expired');return;}
   if(ws.bufferedAmount>1000000){ws.terminate();return;}if(ws.bufferedAmount>64000)return;
   const state=snapshot(room,session.seat);state.code=session.code;state.events=state.events.filter(e=>e.seq>lastSeq);lastSeq=room.match.seq;
   if(state.peerSignal?.seq===signalSeq)state.peerSignal=null;else if(state.peerSignal)signalSeq=state.peerSignal.seq;
   send({type:'state',state});
   if(performance.now()-lastPing>4000){lastPing=performance.now();ws.ping();}
  },50);timer.unref();
  ws.on('message',raw=>{
   const now=performance.now();if(now-windowAt>1000){windowAt=now;count=0;}if(++count>40){ws.close(1008,'Too many inputs');return;}
   let message;try{message=JSON.parse(raw.toString());}catch{ws.close(1008,'Invalid message');return;}
   if(!message||typeof message!=='object')return;
   if(!session){
    token=typeof message.token==='string'?message.token:'';session=sessions.get(token);if(message.type!=='auth'||!session){ws.close(1008,'Invalid session');return;}
    for(const other of wss.clients)if(other!==ws&&other.sessionToken===token)other.close(1000,'Session replaced');
    ws.sessionToken=token;clearTimeout(authTimer);send({type:'connected'});return;
   }
   const room=rooms.get(session.code);if(!room||!sessions.has(token)||room.tokens[session.seat]!==token||!room.match.players[session.seat]){ws.close(1008,'Room expired');return;}
   const m=room.match;m.tick(now);if(!m.players[session.seat]){ws.close(1008,'Room expired');return;}m.players[session.seat].lastSeen=now;
   let error;const body=message.body||{};
   if(message.type==='character')error=m.select(session.seat,body.id);
   else if(message.type==='preview')error=m.preview(session.seat,body.id);
   else if(message.type==='tracking')error=m.tracking(session.seat,body);
   else if(message.type==='move')error=m.choose(session.seat,typeof body.id==='string'?body.id:'',now);
   else if(message.type==='ready')error=m.ready(session.seat,now);
   else if(message.type==='signal')error=signal(room,session.seat,body);
   else if(message.type==='camera'){room.cameraActive??=[false,false];room.cameraActive[session.seat]=body.active===true;}
   else error='Unknown action';
   send({type:'ack',requestId:message.requestId,error:error||null});
  });
  ws.on('close',()=>{clearInterval(timer);clearTimeout(authTimer);});
 });
 server.on('close',()=>{for(const ws of wss.clients)ws.terminate();wss.close();});
 return wss;
}
