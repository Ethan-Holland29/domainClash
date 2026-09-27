import type { BattleEvent, BattleState } from '../../shared/battle.mjs';
export interface NetPlayer {characterId:string|null;previewId?:string|null;tracking?:{hands:number;fps:number;at:number}|null;ready:boolean;
 /** Whether this seat has locked in a move for the current turn. */
 chosen:boolean;
 /** Your own locked-in move (never the opponent's). */
 choice:string|null}
export interface NetEvent {seq:number;type:string;owner?:number;turn?:number;lines?:BattleEvent[];winner?:number|null;reason?:string}
export interface MatchSnapshot {code:string;seat:number;round?:number;returnAt?:number;phase:'waiting'|'countdown'|'playing'|'finished';now:number;startedAt:number;winner:number|null;reason:string;
 /** When the current turn is decided automatically for anyone who has not chosen. */
 deadline:number;battle:BattleState|null;players:(NetPlayer|null)[];events:NetEvent[];peerSignal?:{seq:number;type:"offer"|"answer";sdp:string}|null;cameraActive?:boolean[]}
export class MultiplayerClient {
 private socket:WebSocket|null=null;private live=false;private reconnectTimer=0;private nextRequest=0;
 private pending=new Map<number,{resolve:(ok:boolean)=>void;timer:ReturnType<typeof setTimeout>}>();
 transport='Connecting';
 characterId='gojo';
 private token='';private timer=0;private generation=0;private seq=0;private requests=new Set<AbortController>();
 state:MatchSnapshot|null=null;connected=false;latency=0;
 onState:(state:MatchSnapshot)=>void=()=>{};
 onEvent:(event:NetEvent)=>void=()=>{};
 onStatus:(text:string)=>void=()=>{};
 async connect(code?:string):Promise<void>{
  await this.leave();const generation=++this.generation;
  const result=await this.request(code?'join':'create',code?{code}:{});
  if(generation!==this.generation)return;
  this.token=result.token;
  try{await this.request('character',{id:this.characterId});}catch(error){await this.leave();throw error;}
  if(generation!==this.generation)return;
  this.seq=0;this.connected=true;this.onStatus('Connected. Both players must press Ready.');this.openSocket(generation);void this.poll(generation);
 }
 private async request(route:string,body?:object):Promise<any>{
  const controller=new AbortController();this.requests.add(controller);const timeout=setTimeout(()=>controller.abort(),5000);
  try{const res=await fetch('/api/'+route,{method:body===undefined?'GET':'POST',headers:{...(this.token?{Authorization:'Bearer '+this.token}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
   const data=await res.json().catch(()=>({error:'Multiplayer server unavailable. Start npm run server or open the shared server URL.'}));if(!res.ok)throw Error(data.error||'Connection failed');return data;
  }finally{clearTimeout(timeout);this.requests.delete(controller);}
 }
 private accept(state:MatchSnapshot):void {
  if(this.state&&state.now<this.state.now)return;
  this.connected=true;this.state=state;this.onState(state);
  for(const event of state.events)if(event.seq>this.seq){this.seq=event.seq;this.onEvent(event);}
 }
 private openSocket(generation:number):void {
  const socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/api/live');this.socket=socket;
  socket.onopen=()=>{if(generation===this.generation)socket.send(JSON.stringify({type:'auth',token:this.token}));else socket.close();};
  socket.onmessage=event=>{
   if(generation!==this.generation)return;
   try{const message=JSON.parse(event.data);
    if(message.type==='connected'){this.live=true;this.transport='Live connection';}
    if(message.type==='ping')socket.send(JSON.stringify({type:'pong'}));
    if(message.type==='state')this.accept(message.state);
    if(message.type==='ack'){const pending=this.pending.get(message.requestId);if(pending){clearTimeout(pending.timer);this.pending.delete(message.requestId);pending.resolve(!message.error);}if(message.error)this.onStatus(message.error);}
   }catch{/* Ignore malformed transport data. */}
  };
  socket.onclose=()=>{if(generation===this.generation){this.live=false;this.transport='Polling fallback';this.reconnectTimer=window.setTimeout(()=>{if(generation===this.generation&&this.token)this.openSocket(generation);},3000);}};
  socket.onerror=()=>{};
 }
 private async poll(generation:number):Promise<void>{
  if(generation!==this.generation||!this.token)return;
  if(!this.live){
   const began=performance.now();
   try{const state:MatchSnapshot=await this.request('state');if(generation!==this.generation)return;this.latency=Math.round(performance.now()-began);this.accept(state);}
   catch(error){if(generation!==this.generation)return;this.connected=false;this.onStatus('Connection interrupted. Inputs disabled; retrying. '+(error as Error).message);}
  }
  if(generation===this.generation)this.timer=window.setTimeout(()=>void this.poll(generation),this.live?500:100);
 }
 async action(route:'character'|'preview'|'tracking'|'move'|'ready'|'signal'|'camera',body:object={}):Promise<boolean>{
  if(!this.connected){this.onStatus('Not connected');return false;}
  if(this.live&&this.socket?.readyState===WebSocket.OPEN){
   const requestId=++this.nextRequest;
   return new Promise(resolve=>{
    const timer=setTimeout(()=>{this.pending.delete(requestId);resolve(false);this.onStatus('Input confirmation timed out.');},4000);
    this.pending.set(requestId,{resolve,timer});this.socket!.send(JSON.stringify({type:route,body,requestId}));
   });
  }
  try{await this.request(route,body);return true;}catch(error){this.onStatus((error as Error).message);return false;}
 }
 async video(method:'GET'|'POST'|'DELETE',body?:Blob):Promise<Response>{
  if(!this.token)throw Error('No room');
  return fetch('/api/video',{method,headers:{Authorization:'Bearer '+this.token,...(body?{'Content-Type':'image/jpeg'}:{})},body,cache:'no-store',signal:AbortSignal.timeout(3000)});
 }
 async leave():Promise<void>{
  const token=this.token;this.token='';this.generation++;this.live=false;clearTimeout(this.reconnectTimer);this.socket?.close();this.socket=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.resolve(false);}this.pending.clear();clearTimeout(this.timer);this.requests.forEach(c=>c.abort());this.requests.clear();this.state=null;this.connected=false;
  if(token)try{await fetch('/api/leave',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',keepalive:true,signal:AbortSignal.timeout(2000)});}catch{/* Server ends abandoned matches after heartbeat timeout. */}
 }
}
