import {CameraRelay} from './CameraRelay';
import {MultiplayerClient,type MatchSnapshot} from './MultiplayerClient';
/** Direct WebRTC video, with the existing HTTPS preview only when direct ICE cannot connect. */
export class PeerCamera {
 private client:MultiplayerClient;private local:HTMLVideoElement;private fallback:CameraRelay;
 private pc:RTCPeerConnection|null=null;private sender:RTCRtpSender|null=null;private remote=document.createElement('video');
 private active=false;private generation=0;private lastSignal=0;private track:MediaStreamTrack|null=null;private replacing=false;
 private remoteActive=false;private timeout=0;private connected=false;private attempted=false;
 private statsTimer=0;private profile='';private profileAt=0;private lastFrames=0;private lastStatsAt=0;private lastBufferDelay=0;private lastEmitted=0;
 status='Video off';
 onFrame:(frame:ImageBitmap|null)=>void=()=>{};
 onVideo:(video:HTMLVideoElement|null)=>void=()=>{};
 constructor(client:MultiplayerClient,local:HTMLVideoElement){
  this.client=client;this.local=local;this.fallback=new CameraRelay(client,local);
  this.remote.muted=true;this.remote.playsInline=true;
  this.fallback.onFrame=frame=>{if(this.connected&&frame){frame.close();return;}this.onFrame(frame);};
 }
 start():void {if(this.active)return;this.active=true;this.generation++;this.status='Waiting for opponent';this.fallback.start();}
 stop():void {
  if(!this.active)return;this.active=false;this.generation++;clearTimeout(this.timeout);clearInterval(this.statsTimer);this.pc?.close();this.pc=null;this.sender=null;this.track=null;this.replacing=false;this.lastSignal=0;this.connected=false;this.remote.srcObject=null;this.onVideo(null);this.fallback.stop();this.status='Video off';this.attempted=false;this.profile='';this.lastStatsAt=0;
 }
 async clear():Promise<void>{if(!this.active)return;void this.fallback.clear();void this.client.action('camera',{active:false});if(this.sender)await this.sender.replaceTrack(null).catch(()=>{});this.track=null;}
 update(state:MatchSnapshot):void {
  if(!this.active)return;
  this.remoteActive=!!state.cameraActive?.[1-state.seat];this.onVideo(this.connected&&this.remoteActive?this.remote:null);
  if(state.players[1]&&!this.pc&&!this.attempted)void this.begin(state.seat);
  if(this.pc){void this.syncTrack();const signal=state.peerSignal;if(signal&&signal.seq>this.lastSignal){this.lastSignal=signal.seq;void this.receive(signal,this.generation);}}
 }
 private async begin(seat:number):Promise<void>{
  const generation=this.generation;this.attempted=true;
  try{
   const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]});this.pc=pc;
   if(seat===0)this.sender=pc.addTransceiver('video',{direction:'sendrecv'}).sender;
   pc.ontrack=event=>{if(generation!==this.generation)return;this.remote.srcObject=new MediaStream([event.track]);const receiver=event.receiver as RTCRtpReceiver&{jitterBufferTarget?:number;playoutDelayHint?:number};try{if('jitterBufferTarget' in receiver)receiver.jitterBufferTarget=0;if('playoutDelayHint' in receiver)receiver.playoutDelayHint=0;}catch{/* Browser manages its minimum buffer. */}};
   pc.onconnectionstatechange=()=>{
    if(generation!==this.generation)return;
    this.connected=pc.connectionState==='connected';
    if(this.connected){clearTimeout(this.timeout);this.fallback.stop();this.status='Direct live video';this.onVideo(this.remoteActive?this.remote:null);void this.configure(480,550000);}
    else if(['failed','disconnected','closed'].includes(pc.connectionState)){this.onVideo(null);this.fallback.start();this.status='Live relay · direct video unavailable';}
   };
   this.status='Connecting direct video…';this.timeout=window.setTimeout(()=>{if(generation===this.generation&&!this.connected)this.status='Live relay · direct video unavailable';},15000);
   this.statsTimer=window.setInterval(()=>void this.measure(),2000);
   await this.syncTrack();
   if(seat===0){await pc.setLocalDescription(await pc.createOffer());await this.gather(pc);if(generation===this.generation&&pc.localDescription)await this.client.action('signal',{type:'offer',sdp:pc.localDescription.sdp});}
  }catch{if(generation===this.generation){this.status='Preview fallback · direct video unavailable';this.fallback.start();}}
 }
 private async receive(signal:{type:'offer'|'answer';sdp:string},generation:number):Promise<void>{
  const pc=this.pc;if(!pc)return;
  try{
   await pc.setRemoteDescription({type:signal.type,sdp:signal.sdp});
   if(signal.type==='offer'){
    const transceiver=pc.getTransceivers().find(t=>t.receiver.track.kind==='video');
    if(transceiver)transceiver.direction='sendrecv';this.sender=transceiver?.sender??null;
    await this.syncTrack();await pc.setLocalDescription(await pc.createAnswer());await this.gather(pc);
    if(generation===this.generation&&pc.localDescription)await this.client.action('signal',{type:'answer',sdp:pc.localDescription.sdp});
   }
  }catch{if(generation===this.generation)this.status='Preview fallback · video negotiation failed';}
 }
 private gather(pc:RTCPeerConnection):Promise<void>{
  if(pc.iceGatheringState==='complete')return Promise.resolve();
  return new Promise(resolve=>{const done=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',change);resolve();};const change=()=>{if(pc.iceGatheringState==='complete')done();};const timer=setTimeout(done,5000);pc.addEventListener('icegatheringstatechange',change);});
 }
 private async syncTrack():Promise<void>{
  const sender=this.sender;if(!sender||this.replacing)return;
  const track=(this.local.srcObject as MediaStream|null)?.getVideoTracks().find(t=>t.readyState==='live')??null;
  if(track===this.track)return;this.replacing=true;const generation=this.generation;
  try{
   await sender.replaceTrack(track);if(generation!==this.generation)return;this.track=track;
   if(track){track.contentHint='motion';this.profile='';await this.configure(480,550000);}
   await this.client.action('camera',{active:!!track});
  }catch{/* Preserve fallback if a browser cannot replace a track. */}
  finally{if(generation===this.generation)this.replacing=false;}
 }
 private async configure(width:number,bitrate:number){
  const sender=this.sender;if(!sender||!this.track)return;const key=`${width}:${bitrate}`;if(key===this.profile)return;
  if(this.profile&&bitrate>Number(this.profile.split(':')[1])&&performance.now()-this.profileAt<10000)return;
  const params=sender.getParameters();if(!params.encodings?.length)return;
  params.degradationPreference='maintain-framerate';params.encodings[0].maxBitrate=bitrate;params.encodings[0].maxFramerate=24;params.encodings[0].scaleResolutionDownBy=Math.max(1,(this.track.getSettings().width||640)/width);
  try{await sender.setParameters(params);this.profile=key;this.profileAt=performance.now();}catch{/* Keep the browser's adaptive defaults. */}
 }
 private async measure(){
  const pc=this.pc;if(!pc||!this.connected)return;
  try{const stats=await pc.getStats();if(pc!==this.pc)return;let constrained=false,bandwidth=0,rtt=0;
   stats.forEach(s=>{if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated){bandwidth=s.availableOutgoingBitrate??0;rtt=s.currentRoundTripTime??0;}
    if(s.type==='outbound-rtp'&&s.kind==='video'&&['cpu','bandwidth'].includes(s.qualityLimitationReason))constrained=true;
    if(s.type==='inbound-rtp'&&s.kind==='video'){
     const elapsed=s.timestamp-this.lastStatsAt,frames=s.framesDecoded??0,emitted=s.jitterBufferEmittedCount??0,delay=s.jitterBufferDelay??0;
     if(this.lastStatsAt&&elapsed>0){const fps=Math.max(0,Math.round((frames-this.lastFrames)*1000/elapsed));const buffer=emitted>this.lastEmitted?Math.round((delay-this.lastBufferDelay)*1000/(emitted-this.lastEmitted)):0;this.status=`Direct live video · ${fps} FPS · buffer ${buffer} ms`;}
     this.lastFrames=frames;this.lastStatsAt=s.timestamp;this.lastEmitted=emitted;this.lastBufferDelay=delay;
    }});
   if(constrained||rtt>.3||(bandwidth>0&&bandwidth<650000))await this.configure(360,300000);
   else if(bandwidth>1800000&&rtt<.15)await this.configure(640,850000);
   else await this.configure(480,550000);
  }catch{/* Stats are optional. */}
 }
}
