import { MultiplayerClient } from './MultiplayerClient';
/** A low-bandwidth live preview over the existing authenticated HTTPS room. No microphone. */
export const RELAY_FRAME_INTERVAL_MS = 83;
const MAX_RELAY_FRAME_BYTES=90_000;
export class CameraRelay {
 private generation=0;private timer=0;private sent=false;private lastId='';
 private canvas=document.createElement('canvas');
 private active=false;
 onFrame:(frame:ImageBitmap|null)=>void=()=>{};
 private client:MultiplayerClient;private video:HTMLVideoElement;
 constructor(client:MultiplayerClient,video:HTMLVideoElement){this.client=client;this.video=video;}
 start():void {if(this.active)return;this.active=true;const generation=++this.generation;void this.loop(generation);}
 stop():void {this.active=false;this.generation++;clearTimeout(this.timer);this.lastId='';this.onFrame(null);if(this.sent){this.sent=false;void this.client.video('DELETE').catch(()=>{});}}
 async clear():Promise<void>{this.sent=false;try{await this.client.video('DELETE');}catch{}}
 private async loop(generation:number):Promise<void>{
  const began=performance.now();
  try{await Promise.all([this.send(generation),this.receive(generation)]);}catch{/* Retry transient tunnel errors without interrupting combat. */}
  if(generation===this.generation)this.timer=window.setTimeout(()=>void this.loop(generation),Math.max(0,RELAY_FRAME_INTERVAL_MS-(performance.now()-began)));
 }
 private async send(generation:number):Promise<void>{
  const v=this.video;
  if(!v.srcObject||v.readyState<2||!v.videoWidth){if(this.sent)await this.clear();return;}
  const scale=Math.min(1,480/v.videoWidth,360/v.videoHeight);this.canvas.width=Math.round(v.videoWidth*scale);this.canvas.height=Math.round(v.videoHeight*scale);
  this.canvas.getContext('2d')!.drawImage(v,0,0,this.canvas.width,this.canvas.height);
  let blob=await new Promise<Blob|null>(resolve=>this.canvas.toBlob(resolve,'image/jpeg',.42));
  if(blob&&blob.size>MAX_RELAY_FRAME_BYTES){
   this.canvas.width=Math.max(1,Math.round(this.canvas.width*.75));this.canvas.height=Math.max(1,Math.round(this.canvas.height*.75));
   this.canvas.getContext('2d')!.drawImage(v,0,0,this.canvas.width,this.canvas.height);
   blob=await new Promise<Blob|null>(resolve=>this.canvas.toBlob(resolve,'image/jpeg',.34));
  }
  if(generation!==this.generation||!v.srcObject||!blob||blob.size>MAX_RELAY_FRAME_BYTES)return;
  this.sent=true;await this.client.video('POST',blob);
 }
 private async receive(generation:number):Promise<void>{
  try{
   const response=await this.client.video('GET');if(generation!==this.generation)return;
   if(response.status===204){this.lastId='';this.onFrame(null);return;}
   if(!response.ok)throw Error('Camera connection interrupted');
   const id=response.headers.get('X-Frame-Id')||'';if(id&&id===this.lastId)return;
   const frame=await createImageBitmap(await response.blob());
   if(generation!==this.generation){frame.close();return;}
   this.lastId=id;this.onFrame(frame);
  }catch{if(generation===this.generation){this.lastId='';this.onFrame(null);}}
 }
}
