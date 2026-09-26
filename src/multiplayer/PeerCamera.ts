import {CameraRelay} from './CameraRelay';
import {MultiplayerClient,type MatchSnapshot} from './MultiplayerClient';
/** Direct WebRTC video, with the existing HTTPS preview only when direct ICE cannot connect. */
export class PeerCamera {
 private client:MultiplayerClient;private local:HTMLVideoElement;private fallback:CameraRelay;
 private pc:RTCPeerConnection|null=null;private sender:RTCRtpSender|null=null;private remote=document.createElement('video');
 private active=false;private generation=0;private lastSignal=0;private track:MediaStreamTrack|null=null;private replacing=false;
 private remoteActive=false;private timeout=0;private connected=false;private attempted=false;
 status='Video off';
 onFrame:(frame:ImageBitmap|null)=>void=()=>{};
 onVideo:(video:HTMLVideoElement|null)=>void=()=>{};
 constructor(client:MultiplayerClient,local:HTMLVideoElement){
  this.client=client;this.local=local;this.fallback=new CameraRelay(client,local);
  this.remote.muted=true;this.remote.autoplay=true;this.remote.playsInline=true;
  this.fallback.onFrame=frame=>{if(this.connected&&frame){frame.close();return;}this.onFrame(frame);};
 }
 start():void {if(this.active)return;this.active=true;this.generation++;this.status='Waiting for opponent';this.fallback.start();}
 stop():void {
  if(!this.active)return;this.active=false;this.generation++;clearTimeout(this.timeout);this.pc?.close();this.pc=null;this.sender=null;this.track=null;this.replacing=false;this.lastSignal=0;this.connected=false;this.remote.srcObject=null;this.onVideo(null);this.fallback.stop();this.status='Video off';this.attempted=false;
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
   pc.ontrack=event=>{if(generation!==this.generation)return;this.remote.srcObject=new MediaStream([event.track]);void this.remote.play().catch(()=>{});};
   pc.onconnectionstatechange=()=>{
    if(generation!==this.generation)return;
    this.connected=pc.connectionState==='connected';
    if(this.connected){clearTimeout(this.timeout);this.fallback.stop();this.status='Direct live video · up to 24 FPS';this.onVideo(this.remoteActive?this.remote:null);}
    else if(['failed','disconnected','closed'].includes(pc.connectionState)){this.onVideo(null);this.fallback.start();this.status='Preview fallback · direct video unavailable';}
   };
   this.status='Connecting direct video…';this.timeout=window.setTimeout(()=>{if(generation===this.generation&&!this.connected)this.status='Preview fallback · direct video unavailable';},15000);
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
   if(track){const params=sender.getParameters();if(params.encodings?.length){params.encodings[0].maxBitrate=900000;params.encodings[0].maxFramerate=24;params.encodings[0].scaleResolutionDownBy=Math.max(1,(track.getSettings().width||640)/640);await sender.setParameters(params).catch(()=>{});}}
   await this.client.action('camera',{active:!!track});
  }catch{/* Preserve fallback if a browser cannot replace a track. */}
  finally{if(generation===this.generation)this.replacing=false;}
 }
}

