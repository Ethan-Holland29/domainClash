import {FilesetResolver,HandLandmarker,type HandLandmarkerResult} from '@mediapipe/tasks-vision';
import type {HandTrackingResult,Handedness} from './HandTypes';

/** One transferred frame in flight: inference never queues stale camera frames. */
export class HandTracker {
 private worker:Worker|null=null;
 private model:HandLandmarker|null=null;
 private ready=false;private id=0;private disposed=false;private busy=false;
 private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 get isReady(){return this.ready;}
 async initialize(){
  this.disposed=false;
  const base=new URL(import.meta.env.BASE_URL,location.href).href;
  try{
   this.worker=new Worker(new URL('./tracking.worker.ts',import.meta.url),{type:'module'});
   this.worker.onmessage=({data})=>{const task=this.pending.get(data.id);if(!task)return;clearTimeout(task.timer);this.pending.delete(data.id);data.error?task.reject(Error(data.error)):task.resolve(data);};
   this.worker.onerror=()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Background tracker failed'));}this.pending.clear();};
   await this.call({type:'initialize',base},[],30000);
   console.info('Hand tracking: background worker');
  }catch(error){
   this.worker?.terminate();this.worker=null;
   if(this.disposed)throw error;
   console.warn('Worker tracking unavailable; using compatibility mode.',error);
   const files=await FilesetResolver.forVisionTasks(base+'wasm');
   this.model=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:base+'models/hand_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numHands:2});
  }
  if(this.disposed){this.model?.close();this.model=null;throw Error('Tracker closed');}
  this.ready=true;
 }
 private call(message:object,transfer:Transferable[]=[],timeout=5000):Promise<any>{
  const id=++this.id;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Tracker timed out'));},timeout);this.pending.set(id,{resolve,reject,timer});try{this.worker!.postMessage({...message,id},transfer);}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
 }
 async detectForVideo(video:HTMLVideoElement,timestampMs:number):Promise<HandTrackingResult>{
  if(!this.ready||this.busy)throw Error('Tracker is not ready');
  this.busy=true;
  try{
   let raw:HandLandmarkerResult;
   if(this.worker){
    const bitmap=await createImageBitmap(video);
    if(this.disposed){bitmap.close();throw Error('Tracker closed');}
    raw=(await this.call({type:'detect',bitmap,timestamp:timestampMs},[bitmap],15000)).result;
   }else raw=this.model!.detectForVideo(video,timestampMs);
   return {timestampMs,hands:raw.landmarks.map((landmarks,i)=>({landmarks,worldLandmarks:raw.worldLandmarks[i]??[],handedness:(raw.handednesses[i]?.[0]?.categoryName as Handedness)??'Right',handednessScore:raw.handednesses[i]?.[0]?.score??0}))};
  }catch(error){this.dispose();throw error;}finally{this.busy=false;}
 }
 dispose(){this.disposed=true;this.ready=false;this.worker?.terminate();this.worker=null;this.model?.close();this.model=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Tracker closed'));}this.pending.clear();}
}
